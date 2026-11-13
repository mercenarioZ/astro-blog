// Docker on a Mac as a flow board: macOS on the left, the Linux VM on the
// right, the hypervisor between their kernels. Each flow sends one packet
// through the parts involved, hop by hop; the hop list below explains each.
//
// Markup contract, on any element with [data-dk-stack]:
// - [data-dk-stage] is where the canvas goes; [data-dk-fallback] is the text
//   shown until (or instead of) the 3D view
// - buttons [data-dk-step="run|syscall|files|ports"] with data-title and
//   data-detail
// - a panel holding [data-dk-title], [data-dk-desc] and an <ol data-dk-hops>
//
// three.js is imported only when a figure scrolls into view.

import type { BufferGeometry, Color, Curve, Material, Mesh, Vector3 } from "three";

// One colour per owner: blue macOS, orange the VM boundary, green Linux.
type Plane = "mac" | "vm" | "linux";
type FlowId = "run" | "syscall" | "files" | "ports";
type NodeId =
  | "terminal"
  | "browser"
  | "code"
  | "backend"
  | "xnu"
  | "hypervisor"
  | "vmKernel"
  | "dockerd"
  | "containerd"
  | "runc"
  | "nginx";

type Hop = { to: NodeId; tag: string; text: string; plane: Plane };
type Flow = { from: NodeId; hops: Hop[] };

// The flows, as data, so the hop list works without WebGL too.
const flows: Record<FlowId, Flow> = {
  run: {
    from: "terminal",
    hops: [
      { to: "backend", plane: "mac", tag: "POST /containers/create", text: "The docker CLI is a Mac program. It turns your command into an API request on the Docker socket." },
      { to: "dockerd", plane: "vm", tag: "API request", text: "Docker Desktop forwards that socket through the VM's wall to dockerd." },
      { to: "containerd", plane: "linux", tag: "create", text: "dockerd hands the container to containerd." },
      { to: "runc", plane: "linux", tag: "spec", text: "containerd runs runc with the container's spec." },
      { to: "vmKernel", plane: "linux", tag: "clone() + cgroup", text: "runc asks the VM's Linux kernel for new namespaces and a cgroup." },
      { to: "nginx", plane: "linux", tag: "exec nginx", text: "The kernel starts nginx inside them, as an ordinary process. That process is the container." },
    ],
  },
  syscall: {
    from: "nginx",
    hops: [
      { to: "vmKernel", plane: "linux", tag: "write()", text: "nginx makes a system call. It stops at the VM's Linux kernel, the only kernel nginx can talk to." },
      { to: "hypervisor", plane: "vm", tag: "virtio", text: "To reach a disk or the network, that kernel talks to a virtual device." },
      { to: "xnu", plane: "mac", tag: "I/O request", text: "Apple's Virtualization framework hands the request to macOS, which does the real I/O." },
    ],
  },
  files: {
    from: "nginx",
    hops: [
      { to: "vmKernel", plane: "linux", tag: "open(index.html)", text: "nginx opens a file in its bind-mounted folder, /usr/share/nginx/html." },
      { to: "hypervisor", plane: "vm", tag: "virtiofs", text: "That folder is a VirtioFS share, so the VM's kernel sends the request out of the VM." },
      { to: "xnu", plane: "mac", tag: "file read", text: "macOS receives it as an ordinary file read..." },
      { to: "code", plane: "mac", tag: "~/code/index.html", text: "...of the real file in your folder on the Mac. Every file operation makes this trip, and back." },
    ],
  },
  ports: {
    from: "browser",
    hops: [
      { to: "backend", plane: "mac", tag: "GET localhost:8080", text: "The browser connects to port 8080 on the Mac. Docker Desktop is the one listening there." },
      { to: "hypervisor", plane: "vm", tag: "forward", text: "Docker Desktop forwards the connection into the VM's network." },
      { to: "vmKernel", plane: "linux", tag: "VM network", text: "The VM's Linux kernel receives it..." },
      { to: "nginx", plane: "linux", tag: ":80", text: "...and routes it to port 80 in nginx's own network namespace." },
    ],
  },
};

// Board layout: x left to right, z back (apps) to front (kernels).
type NodeSpec = {
  name: string;
  note: string;
  x: number;
  z: number;
  size: [w: number, h: number, d: number];
  // Kernels are long strips; packets meet them where they come in.
  strip?: boolean;
  fill: "fill" | "macSoft" | "vmSoft" | "linuxSoft";
  container?: boolean;
};

const nodes: Record<NodeId, NodeSpec> = {
  terminal: { name: "Terminal", note: "docker run", x: -7.5, z: -2.4, size: [2, 0.6, 1.2], fill: "fill" },
  browser: { name: "Browser", note: "localhost:8080", x: -5, z: -2.4, size: [2, 0.6, 1.2], fill: "fill" },
  code: { name: "~/code", note: "your files", x: -2.6, z: -2.4, size: [1.8, 0.6, 1.2], fill: "fill" },
  backend: { name: "Docker Desktop", note: "socket + port forwarder", x: -5, z: 0, size: [3.4, 0.6, 1.2], fill: "fill" },
  xnu: { name: "macOS kernel", note: "XNU, not Linux", x: -5.35, z: 2.8, size: [6.3, 0.35, 1.4], fill: "macSoft", strip: true },
  hypervisor: { name: "hypervisor", note: "Virtualization.framework", x: -1, z: 2.8, size: [1.4, 0.8, 1.4], fill: "vmSoft" },
  vmKernel: { name: "Linux kernel", note: "inside the VM", x: 4.35, z: 2.8, size: [8.1, 0.35, 1.4], fill: "linuxSoft", strip: true },
  dockerd: { name: "dockerd", note: "Docker daemon", x: 1.6, z: -2.4, size: [1.8, 0.6, 1.2], fill: "fill" },
  containerd: { name: "containerd", note: "runtime", x: 4.2, z: -2.4, size: [1.8, 0.6, 1.2], fill: "fill" },
  runc: { name: "runc", note: "makes the sandbox", x: 6.8, z: -2.4, size: [1.8, 0.6, 1.2], fill: "fill" },
  nginx: { name: "nginx container", note: "one process, own namespaces", x: 5.2, z: 0, size: [2.6, 0.9, 1.3], fill: "fill", container: true },
};

const tokens = {
  fill: "--color-paper-2",
  edge: "--color-ink-2",
  mac: "--dk-mac",
  vm: "--dk-vm",
  linux: "--dk-linux",
  macSoft: "--dk-mac-soft",
  vmSoft: "--dk-vm-soft",
  linuxSoft: "--dk-linux-soft",
  macTile: "--dk-mac-soft",
  vmTile: "--dk-vm-soft",
  vmWall: "--dk-vm",
};

// Scene units per second, and the rest at the end of a flow before it repeats.
const speed = 2.4;
const pause = 1.2;

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
  labels.domElement.classList.add("dk-stack__labels");
  stage.append(renderer.domElement, labels.domElement);

  const scene = new THREE.Scene();
  const target = new THREE.Vector3(0, 0, 0.4);
  const camera = new THREE.PerspectiveCamera(32, 1, 1, 100);
  camera.position.set(0, 14, 15);

  // Unlit fills plus ink outlines, like the blog's other diagrams.
  const fillOptions = { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 };
  const tile = { ...fillOptions, transparent: true, opacity: 0.45, depthWrite: false };
  const materials = {
    fill: new THREE.MeshBasicMaterial(fillOptions),
    edge: new THREE.LineBasicMaterial(),
    mac: new THREE.MeshBasicMaterial(),
    vm: new THREE.MeshBasicMaterial(),
    linux: new THREE.MeshBasicMaterial(),
    macSoft: new THREE.MeshBasicMaterial(fillOptions),
    vmSoft: new THREE.MeshBasicMaterial(fillOptions),
    linuxSoft: new THREE.MeshBasicMaterial(fillOptions),
    macTile: new THREE.MeshBasicMaterial(tile),
    vmTile: new THREE.MeshBasicMaterial(tile),
    vmWall: new THREE.LineDashedMaterial({ dashSize: 0.25, gapSize: 0.18 }),
  };

  // Each node gets its own copies of its materials, so it can dim alone.
  type Copy = { copy: Material & { color: Color }; base: Material & { color: Color } };
  const copies: Copy[] = [];
  const own = <T extends Material & { color: Color }>(base: T) => {
    const copy = base.clone() as T;
    copy.transparent = true;
    copies.push({ copy, base });
    return copy;
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
    for (const { copy, base } of copies) copy.color.copy(base.color);
  };
  applyTheme();
  const themeObserver = new MutationObserver(applyTheme);
  themeObserver.observe(document.documentElement, { attributeFilter: ["class"] });

  const outline = (geometry: BufferGeometry, material: Material = materials.edge) => {
    const lines = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), material);
    lines.computeLineDistances(); // only dashed materials need it
    return lines;
  };

  const label = (name: string, note: string, plane?: Plane) => {
    const element = document.createElement("div");
    element.className = "dk-stack__label";
    if (plane) element.dataset.plane = plane;
    const number = document.createElement("span");
    number.className = "dk-stack__number";
    const small = document.createElement("small");
    small.textContent = note;
    element.append(number, name, small);
    return { object: new CSS2DObject(element), element, number };
  };

  // The two zones. The VM's zone has a dashed wall: everything crossing it
  // is forwarded by Docker Desktop.
  const zone = (x: number, width: number, material: Material) => {
    const geometry = new THREE.BoxGeometry(width, 0.2, 8);
    const part = new THREE.Group().add(new THREE.Mesh(geometry, material), outline(geometry));
    part.position.set(x, -0.1, 0);
    return part;
  };
  const wall = outline(new THREE.BoxGeometry(8.9, 2.4, 8), materials.vmWall);
  wall.position.set(4.35, 1.2, 0);
  const zoneLabel = (name: string, note: string, x: number, plane: Plane) => {
    const { object } = label(name, note, plane);
    object.element.classList.add("dk-stack__label--zone");
    object.position.set(x, 2.4, -4); // over the back edge, clear of the nodes
    return object;
  };
  scene.add(
    zone(-5.25, 7.7, materials.macTile),
    zone(4.35, 8.9, materials.vmTile),
    wall,
    zoneLabel("macOS", "your Mac", -5.25, "mac"),
    zoneLabel("Linux VM", "started by Docker Desktop", 4.35, "vm"),
  );

  type Built = { spec: NodeSpec; copies: Copy[]; element: HTMLElement; number: HTMLElement };
  const built = {} as Record<NodeId, Built>;
  for (const [id, spec] of Object.entries(nodes) as [NodeId, NodeSpec][]) {
    const [w, h, d] = spec.size;
    const before = copies.length;
    const geometry = new THREE.BoxGeometry(w, h, d);
    const group = new THREE.Group().add(
      new THREE.Mesh(geometry, own(materials[spec.fill])),
      new THREE.LineSegments(new THREE.EdgesGeometry(geometry), own(materials.edge)),
    );
    if (spec.container) {
      // Ribs, so it reads as a shipping container, and the one process in it.
      const ribs = own(materials.edge);
      for (const offset of [-0.9, -0.45, 0, 0.45, 0.9]) {
        group.add(outline(new THREE.BoxGeometry(0.01, h, d), ribs).translateX(offset));
      }
      group.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), own(materials.linux)).translateY(h / 2 + 0.16));
    }
    group.position.set(spec.x, h / 2, spec.z);
    scene.add(group);

    const plane: Plane | undefined =
      spec.fill === "macSoft" ? "mac" : spec.fill === "vmSoft" ? "vm" : spec.fill === "linuxSoft" ? "linux" : undefined;
    const { object, element, number } = label(spec.name, spec.note, plane);
    // Hung below the front edge, so paths arriving on top stay visible.
    object.position.set(spec.x, 0, spec.z + d / 2 + 0.1);
    object.center.set(0.5, 0);
    scene.add(object);
    built[id] = { spec, copies: copies.slice(before), element, number };
  }

  // Where a path meets a node: on top, or on a strip right below the other end.
  const anchor = (id: NodeId, otherX: number) => {
    const { x, z, size, strip } = nodes[id];
    const [w, h] = size;
    const px = strip ? Math.min(Math.max(otherX, x - w / 2 + 0.6), x + w / 2 - 0.6) : x;
    return new THREE.Vector3(px, h, z);
  };

  // Up and over, higher for longer jumps.
  const curveFor = (from: NodeId, to: NodeId) => {
    const start = anchor(from, nodes[to].x);
    const end = anchor(to, nodes[from].x);
    const middle = start.clone().lerp(end, 0.5);
    middle.y = Math.max(start.y, end.y) + 0.8 + start.distanceTo(end) * 0.12;
    return new THREE.QuadraticBezierCurve3(start, middle, end);
  };

  type Leg = { curve: Curve<Vector3>; mesh: Mesh; length: number; hop: Hop };
  let legs: Leg[] = [];
  let total = 0;
  const packet = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), materials.linux);
  const tag = document.createElement("div");
  tag.className = "dk-stack__tag";
  const tagObject = new CSS2DObject(tag);
  tagObject.center.set(0.5, 1.6);
  packet.add(tagObject);
  scene.add(packet);

  let current = -1;
  let elapsed = 0;

  const setStep = (id: FlowId) => {
    const flow = flows[id];
    const order = [flow.from, ...flow.hops.map((hop) => hop.to)];

    // Parts of this flow at full strength and numbered; the rest dimmed.
    for (const [nodeId, node] of Object.entries(built) as [NodeId, Built][]) {
      const index = order.indexOf(nodeId);
      const on = index !== -1;
      for (const { copy, base } of node.copies) {
        copy.opacity = on ? base.opacity : 0.18;
        copy.depthWrite = on;
      }
      node.element.style.opacity = on ? "1" : "0.3";
      node.element.toggleAttribute("data-dim", !on);
      node.number.textContent = on ? String(index + 1) : "";
    }

    for (const leg of legs) {
      scene.remove(leg.mesh);
      leg.mesh.geometry.dispose();
    }
    legs = flow.hops.map((hop, index) => {
      const curve = curveFor(order[index], hop.to);
      const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.04, 6), materials[hop.plane]);
      scene.add(mesh);
      return { curve, mesh, length: curve.getLength(), hop };
    });
    total = legs.reduce((sum, leg) => sum + leg.length, 0);

    // Each flow starts from its first hop.
    elapsed = 0;
    current = -1;
  };

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(target);
  controls.enableZoom = false; // leave the wheel for scrolling the page
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.minPolarAngle = 0.35;
  controls.maxPolarAngle = 1.2;
  controls.minAzimuthAngle = -0.9;
  controls.maxAzimuthAngle = 0.9;
  // Horizontal drags orbit; vertical swipes still scroll the page on touch.
  renderer.domElement.style.touchAction = "pan-y";

  const resize = () => {
    const { width, height } = stage.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    labels.setSize(width, height);
    camera.aspect = width / height;
    // Back away on narrow stages so the whole board stays in frame.
    const distance = 25 * Math.max(1, 1.5 / camera.aspect);
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

    // The first frame's timestamp can be earlier than `last`; a hidden tab
    // should not make the packet jump.
    const delta = Math.min(Math.max(0, now - last) / 1000, 0.1);
    last = now;
    if (!visible) return;
    if (!reducedMotion.matches) elapsed += delta;

    if (legs.length > 0) {
      // Travel the legs one after another, then rest on the last node.
      let distance = (elapsed % (total / speed + pause)) * speed;
      let index = 0;
      while (index < legs.length - 1 && distance > legs[index].length) {
        distance -= legs[index].length;
        index += 1;
      }
      const leg = legs[index];
      leg.curve.getPointAt(Math.min(distance / leg.length, 1), packet.position);
      packet.rotation.y = elapsed * 2;

      if (index !== current) {
        current = index;
        packet.material = materials[leg.hop.plane];
        tag.textContent = leg.hop.tag;
        tag.dataset.plane = leg.hop.plane;
      }
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
  for (const figure of document.querySelectorAll<HTMLElement>("[data-dk-stack]")) {
    if (figure.hasAttribute("data-dk-ready")) continue;
    figure.setAttribute("data-dk-ready", "true");

    const stage = figure.querySelector<HTMLElement>("[data-dk-stage]");
    const fallback = figure.querySelector<HTMLElement>("[data-dk-fallback]");
    const title = figure.querySelector("[data-dk-title]");
    const description = figure.querySelector("[data-dk-desc]");
    const hopList = figure.querySelector<HTMLOListElement>("[data-dk-hops]");
    const buttons = [...figure.querySelectorAll<HTMLButtonElement>("[data-dk-step]")];
    if (!stage || !title || !description || !hopList || buttons.length === 0) continue;

    let current = buttons[0].dataset.dkStep as FlowId;
    let model: Awaited<ReturnType<typeof mount>> | undefined;

    // The buttons, panel and hop list work on their own, with or without WebGL.
    const render = () => {
      for (const button of buttons) {
        const on = button.dataset.dkStep === current;
        button.setAttribute("aria-pressed", String(on));
        if (!on) continue;
        title.textContent = button.dataset.title ?? "";
        description.textContent = button.dataset.detail ?? "";
      }
      const flow = flows[current];
      const order = [flow.from, ...flow.hops.map((hop) => hop.to)];
      hopList.replaceChildren(
        ...flow.hops.map((hop, index) => {
          const item = document.createElement("li");
          item.dataset.plane = hop.plane;
          const route = document.createElement("span");
          route.className = "dk-stack__hop-route";
          // Same numbers as the badges in the model.
          route.textContent = `${index + 1} → ${index + 2} · ${nodes[order[index]].name} → ${nodes[hop.to].name}`;
          item.append(route, hop.text);
          return item;
        }),
      );
      model?.setStep(current);
    };

    for (const button of buttons) {
      button.addEventListener("click", () => {
        current = button.dataset.dkStep as FlowId;
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
          if (fallback) fallback.textContent = "The 3D view needs WebGL. The flows below still work.";
        }
      },
      { rootMargin: "400px" },
    );
    loader.observe(stage);
  }
};

setup();
document.addEventListener("astro:page-load", setup);
