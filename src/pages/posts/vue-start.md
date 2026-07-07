---
title: Vue starter
description: My learning notes on Vue components, reactivity, templates, props, and events
slug: vue-start
tags:
  - notes
  - vue
  - react
heroImage: /posts/vue-start.png
createdAt: 2026-07-04
layout: ../../layouts/BlogPost.astro
---

Vue and React solve many of the same UI problems, but they push code toward different shapes.

React keeps JavaScript at the center through JSX, hooks, and function components. Vue gives templates a first-class role, then connects them to a reactive state system. For someone coming from React, the fastest way to understand Vue is to map familiar ideas across: components, state, props, events, derived values, and side effects.

## Component shape

In React, a component is commonly written as a function that returns JSX.

```jsx
import { useState } from 'react'

function Counter() {
  const [count, setCount] = useState(0)

  return (
    <button onClick={() => setCount(count + 1)}>
      Count: {count}
    </button>
  )
}
```

In Vue, a component is commonly written as a Single-File Component.

```vue
<script setup>
import { ref } from 'vue'

const count = ref(0)

function increment() {
  count.value++
}
</script>

<template>
  <button @click="increment">
    Count: {{ count }}
  </button>
</template>
```

The split is intentional: the script owns the data and behavior, while the template owns the rendered structure.

## State with `ref`

React state often starts with `useState`.

```jsx
const [count, setCount] = useState(0)
```

Vue state often starts with `ref`.

```js
const count = ref(0)
```

Inside JavaScript, the current value is accessed through `.value`.

```js
count.value++
```

Inside the template, Vue unwraps refs automatically.

```vue
<template>
  <p>{{ count }}</p>
</template>
```

The practical rule: use `.value` in script, but not in the template.

## Template syntax

Vue templates have their own syntax for common UI work.

Render a value:

```vue
<p>{{ message }}</p>
```

Bind an attribute:

```vue
<img :src="avatarUrl" alt="Avatar" />
```

Listen to an event:

```vue
<button @click="save">Save</button>
```

The `:` syntax means binding. The `@` syntax means event listener.

## Conditional rendering

React uses JavaScript expressions for conditional rendering.

```jsx
{isLoggedIn ? <p>Welcome back</p> : <p>Please sign in</p>}
```

Vue uses template directives such as `v-if` and `v-else`.

```vue
<template>
  <p v-if="isLoggedIn">Welcome back</p>
  <p v-else>Please sign in</p>
</template>
```

This keeps common template conditions close to the markup.

## Rendering lists

React uses `map` to render lists.

```jsx
todos.map((todo) => (
  <li key={todo.id}>{todo.text}</li>
))
```

Vue uses `v-for`.

```vue
<template>
  <ul>
    <li v-for="todo in todos" :key="todo.id">
      {{ todo.text }}
    </li>
  </ul>
</template>
```

The `:key` part is still important, just like React's `key`.

## Form input with `v-model`

In React, form state often needs `value` and `onChange`.

```jsx
<input value={name} onChange={(event) => setName(event.target.value)} />
```

Vue can handle simple two-way input binding with `v-model`.

```vue
<script setup>
import { ref } from 'vue'

const name = ref('')
</script>

<template>
  <input v-model="name" />
  <p>Hello, {{ name }}</p>
</template>
```

For normal form fields, this removes the repeated `value` plus change handler wiring.

## Props

Props are still parent-to-child data.

```vue
<script setup>
defineProps({
  title: String
})
</script>

<template>
  <h2>{{ title }}</h2>
</template>
```

This is the same parent-to-child idea as React props, but Vue declares the contract with `defineProps`.

## Events from child to parent

React commonly passes a callback prop from parent to child.

Vue components can emit events instead.

```vue
<script setup>
const emit = defineEmits(['submit'])

function submitForm() {
  emit('submit')
}
</script>

<template>
  <button @click="submitForm">Submit</button>
</template>
```

Then the parent listens to that event.

```vue
<ChildForm @submit="handleSubmit" />
```

The mental model is simple: props go down, events go up.

## Derived state with `computed`

React can use `useMemo` for values derived from other values.

Vue uses `computed`.

```vue
<script setup>
import { ref, computed } from 'vue'

const firstName = ref('Ada')
const lastName = ref('Lovelace')

const fullName = computed(() => {
  return `${firstName.value} ${lastName.value}`
})
</script>

<template>
  <p>{{ fullName }}</p>
</template>
```

The computed value updates when the reactive values it depends on change.

## Side effects

React has `useEffect` for side effects.

Vue separates this into lifecycle hooks and watchers.

```js
import { onMounted } from 'vue'

onMounted(() => {
  console.log('component mounted')
})
```

To react to a specific reactive value changing, use `watch`.

```js
import { ref, watch } from 'vue'

const search = ref('')

watch(search, (newValue) => {
  console.log('search changed:', newValue)
})
```

Lifecycle hooks are about component lifecycle moments. Watchers are about reactive data changes.

## First Vue checklist

The core concepts to practice first:

- Single-File Components
- `ref`
- `computed`
- `v-if`
- `v-for`
- `v-model`
- `defineProps`
- `defineEmits`
- `onMounted`
- `watch`

After those basics, Vue Router covers pages and navigation, while Pinia covers shared state.

## Final note

Learning Vue from React is mostly about translating ideas without forcing Vue to look like React.

React feels like writing UI inside JavaScript. Vue feels like writing HTML templates connected to reactive JavaScript.

That difference is the main mental shift.
