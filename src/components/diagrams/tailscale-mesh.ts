// 3D model of a small tailnet: three devices on three private networks, the
// coordination server above them and a DERP relay between them.
//
// Markup contract, on any element with [data-ts-mesh]:
// - [data-ts-stage] is where the canvas goes; [data-ts-fallback] is the text
//   shown until (or instead of) the 3D view
// - buttons [data-ts-step="keys|peers|relay|direct|all"] with data-title and
//   data-detail
// - a panel holding [data-ts-title] and [data-ts-desc]
//
// three.js is imported only when a figure scrolls into view.

import type { BufferGeometry, Curve, Group, Material, Mesh, Vector3 } from "three";

type StepId = "keys" | "peers" | "relay" | "direct" | "all";
// Each plane has its own colour: blue control, orange relay, green direct.
type Plane = "control" | "relay" | "direct";
type SiteId = "laptop" | "server" | "phone";

type Path = { curve: Curve<Vector3>; meshes: Mesh[]; plane: Plane };
// One leg of a packet's trip: a path, and whether it is travelled backwards.
type Hop = [path: Path, reverse?: boolean];
// `tag` names what the packets are carrying; it rides along with them.
type StepScene = { lit: Path[]; routes: Hop[][]; perRoute: number; tag?: string };

const sites: { id: SiteId; name: string; note: string; x: number; z: number; top: number }[] = [
  { id: "laptop", name: "your laptop", note: "100.64.0.1 · home NAT", x: -5.6, z: 3.2, top: 1.05 },
  { id: "server", name: "your server", note: "100.64.0.2 · office NAT", x: 5.6, z: 3.2, top: 1.4 },
  { id: "phone", name: "your phone", note: "100.64.0.3 · carrier NAT", x: 0, z: -6.4, top: 1.25 },
];

const tokens = {
  fill: "--color-paper-2",
  edge: "--color-ink-2",
  wall: "--color-rule-2",
  control: "--ts-control",
  relay: "--ts-relay",
  direct: "--ts-direct",
  controlSoft: "--ts-control-soft",
  relaySoft: "--ts-relay-soft",
  directSoft: "--ts-direct-soft",
};

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const mount = async (figure: HTMLElement, stage: HTMLElement) => {
  const THREE = await import("three");
  const { OrbitControls } = await import("three/addons/controls/OrbitControls.js");
  const { CSS2DObject, CSS2DRenderer } = await import(
    "three/addons/renderers/CSS2DRenderer.js"
  );

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const labels = new CSS2DRenderer();
  labels.domElement.classList.add("ts-mesh__labels");
  stage.append(renderer.domElement, labels.domElement);

  const scene = new THREE.Scene();
  const target = new THREE.Vector3(0, 2.7, 0);
  const camera = new THREE.PerspectiveCamera(32, 1, 1, 100);
  camera.position.set(9, 10, 20);

  // Unlit fills plus ink outlines, so the model reads as a line drawing in
  // the blog's palette. The offset keeps outlines from fighting their fills.
  const fillOptions = { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 };
  const materials = {
    fill: new THREE.MeshBasicMaterial(fillOptions),
    edge: new THREE.LineBasicMaterial(),
    wall: new THREE.LineDashedMaterial({ dashSize: 0.2, gapSize: 0.16 }),
    control: new THREE.MeshBasicMaterial(),
    relay: new THREE.MeshBasicMaterial(),
    direct: new THREE.MeshBasicMaterial(),
    controlSoft: new THREE.MeshBasicMaterial(fillOptions),
    relaySoft: new THREE.MeshBasicMaterial(fillOptions),
    directSoft: new THREE.MeshBasicMaterial(fillOptions),
  };

  // The tokens are oklch(), which three.js cannot parse, so let a canvas
  // resolve them to sRGB first.
  const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  const applyTheme = () => {
    if (!probe) return;
    const styles = getComputedStyle(figure);
    for (const key of Object.keys(tokens) as (keyof typeof tokens)[]) {
      probe.fillStyle = styles.getPropertyValue(tokens[key]);
      probe.fillRect(0, 0, 1, 1);
      const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
      materials[key].color.setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
    }
  };
  applyTheme();
  const themeObserver = new MutationObserver(applyTheme);
  themeObserver.observe(document.documentElement, { attributeFilter: ["class"] });

  const outlined = (geometry: BufferGeometry, fill: Material) => {
    const group = new THREE.Group();
    group.add(
      new THREE.Mesh(geometry, fill),
      new THREE.LineSegments(new THREE.EdgesGeometry(geometry), materials.edge),
    );
    return group;
  };

  const box = (w: number, h: number, d: number, y: number, fill: Material = materials.directSoft) => {
    const part = outlined(new THREE.BoxGeometry(w, h, d), fill);
    part.position.y = y;
    return part;
  };

  const label = (name: string, note: string, x: number, y: number, z: number, plane?: Plane) => {
    const element = document.createElement("div");
    element.className = "ts-mesh__label";
    if (plane) element.dataset.plane = plane;
    const small = document.createElement("small");
    small.textContent = note;
    element.append(name, small);
    const object = new CSS2DObject(element);
    object.position.set(x, y, z);
    return object;
  };

  const models: Record<SiteId, () => Group> = {
    laptop: () => {
      const screen = box(1.4, 0.9, 0.06, 0.5);
      screen.position.z = -0.5;
      screen.rotation.x = -0.25;
      return new THREE.Group().add(box(1.4, 0.08, 0.9, 0.04), screen);
    },
    server: () =>
      new THREE.Group().add(...[0, 1, 2].map((unit) => box(1.2, 0.36, 1.2, 0.2 + unit * 0.44))),
    phone: () => {
      const body = box(0.55, 1.1, 0.08, 0.6);
      body.rotation.x = -0.2;
      return new THREE.Group().add(body);
    },
  };

  // Each private network: a platform, a dashed NAT boundary, one device.
  const anchors = {} as Record<SiteId, Vector3>;
  for (const site of sites) {
    const island = new THREE.Group();
    island.position.set(site.x, 0, site.z);

    const wall = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(4.4, 2.6, 4.4)),
      materials.wall,
    );
    wall.computeLineDistances();
    wall.position.y = 1.3;

    const device = models[site.id]();
    device.rotation.y = Math.atan2(-site.x, -site.z); // face the middle

    island.add(box(4.4, 0.3, 4.4, -0.15, materials.fill), wall, device);
    // Above the outer edge of the NAT box, clear of the paths in the middle.
    const outward = 1.2 / Math.hypot(site.x, site.z);
    island.add(label(site.name, site.note, site.x * outward, 3.2, site.z * outward, "direct"));
    scene.add(island);
    anchors[site.id] = new THREE.Vector3(site.x, site.top, site.z);
  }

  const coordinator = outlined(new THREE.IcosahedronGeometry(0.85, 0), materials.controlSoft);
  coordinator.position.set(0, 6.4, 0);
  scene.add(coordinator, label("coordination server", "run by Tailscale", 0, 7.9, 0, "control"));

  const relay = new THREE.Group().add(
    outlined(new THREE.CylinderGeometry(1.5, 1.5, 0.3, 6), materials.fill),
    outlined(new THREE.CylinderGeometry(0.45, 0.45, 1.3, 8), materials.relaySoft),
  );
  relay.children[0].position.y = -0.15;
  relay.children[1].position.y = 0.65;
  scene.add(relay, label("DERP relay", "run by Tailscale, near you", 0, -1, 0, "relay"));
  const relayTop = new THREE.Vector3(0, 1.3, 0);

  const arc = (from: Vector3, to: Vector3, lift: number, bulge = 1) => {
    const middle = from.clone().lerp(to, 0.5).multiplyScalar(bulge);
    middle.y = (from.y + to.y) / 2 + lift;
    return new THREE.QuadraticBezierCurve3(from, middle, to);
  };

  // Data paths are solid tubes; control paths are dashed.
  const solid = (curve: Curve<Vector3>, plane: Plane): Path => ({
    curve,
    plane,
    meshes: [new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.045, 6), materials[plane])],
  });

  const dashed = (curve: Curve<Vector3>): Path => {
    const up = new THREE.Vector3(0, 1, 0);
    const count = Math.round(curve.getLength() / 0.45);
    const meshes = Array.from({ length: count }, (_, index) => {
      const start = curve.getPointAt(index / count);
      const end = curve.getPointAt((index + 0.5) / count);
      const dash = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, start.distanceTo(end), 5),
        materials.control,
      );
      dash.position.copy(start).lerp(end, 0.5);
      dash.quaternion.setFromUnitVectors(up, end.sub(start).normalize());
      return dash;
    });
    return { curve, meshes, plane: "control" };
  };

  const pathsBySite = (make: (from: Vector3) => Path) =>
    Object.fromEntries(sites.map(({ id }) => [id, make(anchors[id])])) as Record<SiteId, Path>;

  const control = pathsBySite((from) => dashed(new THREE.LineCurve3(from, coordinator.position)));
  const viaRelay = pathsBySite((from) => solid(arc(from, relayTop, 1.2), "relay"));
  const direct = [
    solid(arc(anchors.laptop, anchors.server, 2.4, 1.5), "direct"),
    solid(arc(anchors.server, anchors.phone, 2.4, 1.5), "direct"),
    solid(arc(anchors.phone, anchors.laptop, 2.4, 1.5), "direct"),
  ];

  const paths = [...Object.values(control), ...Object.values(viaRelay), ...direct];
  scene.add(...paths.flatMap((path) => path.meshes));

  const stepScenes: Record<StepId, StepScene> = {
    keys: {
      lit: Object.values(control),
      routes: Object.values(control).map((path) => [[path]]),
      perRoute: 2,
      tag: "public key",
    },
    peers: {
      lit: Object.values(control),
      routes: Object.values(control).map((path) => [[path, true]]),
      perRoute: 2,
      tag: "peer keys + rules",
    },
    relay: {
      lit: Object.values(viaRelay),
      routes: [
        [[viaRelay.laptop], [viaRelay.server, true]],
        [[viaRelay.server], [viaRelay.phone, true]],
        [[viaRelay.phone], [viaRelay.laptop, true]],
      ],
      perRoute: 2,
      tag: "encrypted packet",
    },
    direct: {
      lit: direct,
      routes: direct.flatMap((path): Hop[][] => [[[path]], [[path, true]]]),
      perRoute: 1,
      tag: "encrypted packet",
    },
    // Everything at once, to compare the three planes by colour.
    all: {
      lit: paths,
      routes: [
        ...Object.values(control).map((path): Hop[] => [[path]]),
        ...direct.map((path): Hop[] => [[path]]),
      ],
      perRoute: 1,
    },
  };

  const packetGeometry = new THREE.OctahedronGeometry(0.16);
  let packets: { mesh: Mesh; route: Hop[]; offset: number }[] = [];

  const setStep = (id: StepId) => {
    const step = stepScenes[id];
    // Only the paths this step is about are drawn.
    for (const path of paths) {
      for (const mesh of path.meshes) mesh.visible = step.lit.includes(path);
    }

    // clear() first, so the tags riding on the old packets leave the page too.
    for (const packet of packets) scene.remove(packet.mesh.clear());
    packets = step.routes.flatMap((route, routeIndex) =>
      Array.from({ length: step.perRoute }, (_, index) => {
        const plane = route[0][0].plane;
        const mesh = new THREE.Mesh(packetGeometry, materials[plane]);
        // One tag per route is enough to say what is moving.
        if (step.tag && index === 0 && (step.perRoute > 1 || routeIndex % 2 === 0)) {
          const element = document.createElement("div");
          element.className = "ts-mesh__tag";
          element.dataset.plane = plane;
          element.textContent = step.tag;
          const tag = new CSS2DObject(element);
          tag.center.set(0.5, 1.5);
          mesh.add(tag);
        }
        // Stagger opposite directions so they do not all meet mid-path.
        return { mesh, route, offset: index / step.perRoute + (routeIndex % 2) * 0.25 };
      }),
    );
    scene.add(...packets.map((packet) => packet.mesh));
  };

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(target);
  controls.enableZoom = false; // leave the wheel for scrolling the page
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.minPolarAngle = 0.5;
  controls.maxPolarAngle = 1.45;
  controls.autoRotate = !reducedMotion.matches;
  controls.autoRotateSpeed = 0.25;
  controls.addEventListener("start", () => (controls.autoRotate = false));
  // Horizontal drags orbit; vertical swipes still scroll the page on touch.
  renderer.domElement.style.touchAction = "pan-y";

  const resize = () => {
    const { width, height } = stage.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    labels.setSize(width, height);
    camera.aspect = width / height;
    // Back away on narrow stages so the whole tailnet stays in frame.
    const distance = 26 * Math.max(1, 1.3 / camera.aspect);
    camera.position.sub(target).setLength(distance).add(target);
    camera.updateProjectionMatrix();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(stage);
  resize();

  let visible = true;
  const visibilityObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
  });
  visibilityObserver.observe(stage);

  let elapsed = 0;
  let last = performance.now();
  const frame = (now: number) => {
    // Client-side navigation removed the figure: stop and free the context.
    if (!figure.isConnected) {
      themeObserver.disconnect();
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      return;
    }
    requestAnimationFrame(frame);

    // The first frame's timestamp can be earlier than `last`.
    const delta = Math.max(0, now - last) / 1000;
    last = now;
    if (!visible) return;
    if (!reducedMotion.matches) elapsed += delta;

    coordinator.rotation.y = elapsed * 0.15;
    for (const { mesh, route, offset } of packets) {
      // About five seconds per hop.
      const progress = ((elapsed * 0.2) / route.length + offset) % 1;
      const scaled = progress * route.length;
      const index = Math.min(Math.floor(scaled), route.length - 1);
      const [path, reverse] = route[index];
      const t = scaled - index;
      path.curve.getPointAt(reverse ? 1 - t : t, mesh.position);
      mesh.rotation.y = elapsed;
    }

    controls.update();
    renderer.render(scene, camera);
    labels.render(scene, camera);
  };
  requestAnimationFrame(frame);

  return { setStep };
};

// Works on first load and after Astro's client-side navigation, and binds
// each figure only once.
const setup = () => {
  for (const figure of document.querySelectorAll<HTMLElement>("[data-ts-mesh]")) {
    if (figure.hasAttribute("data-ts-ready")) continue;
    figure.setAttribute("data-ts-ready", "true");

    const stage = figure.querySelector<HTMLElement>("[data-ts-stage]");
    const fallback = figure.querySelector<HTMLElement>("[data-ts-fallback]");
    const title = figure.querySelector("[data-ts-title]");
    const description = figure.querySelector("[data-ts-desc]");
    const buttons = [...figure.querySelectorAll<HTMLButtonElement>("[data-ts-step]")];
    if (!stage || !title || !description || buttons.length === 0) continue;

    let current = buttons[0].dataset.tsStep as StepId;
    let model: Awaited<ReturnType<typeof mount>> | undefined;

    // The buttons and panel work on their own, with or without WebGL.
    const render = () => {
      for (const button of buttons) {
        const on = button.dataset.tsStep === current;
        button.setAttribute("aria-pressed", String(on));
        if (!on) continue;
        title.textContent = button.dataset.title ?? "";
        description.textContent = button.dataset.detail ?? "";
      }
      model?.setStep(current);
    };

    for (const button of buttons) {
      button.addEventListener("click", () => {
        current = button.dataset.tsStep as StepId;
        render();
      });
    }
    render();

    const loader = new IntersectionObserver(
      async ([entry]) => {
        if (!entry.isIntersecting) return;
        loader.disconnect();
        try {
          model = await mount(figure, stage);
          fallback?.remove();
          render();
        } catch {
          if (fallback) fallback.textContent = "The 3D view needs WebGL. The steps below still work.";
        }
      },
      { rootMargin: "400px" },
    );
    loader.observe(stage);
  }
};

setup();
document.addEventListener("astro:page-load", setup);
