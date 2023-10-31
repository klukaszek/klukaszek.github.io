<script lang="ts">
  import "../app.postcss";
  import { base } from "$app/paths";
</script>

<div class="bg-zinc-800 h-screen flex flex-col">
  <!-- Navigation bar -->
  <div class="bg-zinc-900 shadow outline outline-1 outline-gray-600">
    <div class="container mx-auto flex justify-between items-center py-4">
      <!-- Site title -->
      <div class="text-2xl font-bold text-gray-200 font-mono">
        Kyle Lukaszek
      </div>

      <!-- Navigation links -->
      <div class="space-x-4">
        <a
          class="text-gray-200 hover:text-gray-600 cursor-pointer"
          href={`${base}/`}
        >
          Home
        </a>
        <a
          class="text-gray-200 hover:text-gray-600 cursor-pointer"
          href={`${base}/about`}
        >
          About
        </a>
        <a
          class="text-gray-200 hover:text-gray-600 cursor-pointer"
          href={`${base}/projects`}
        >
          Projects
        </a>
      </div>
    </div>
  </div>

  <!-- Main content area -->
  <div
    class="container mx-auto my-4 flex-1 items-center justify-center text-gray-200"
  >
    <slot />
  </div>

  <!-- Footer section -->
  <div
    class="bg-zinc-900 outline outline-1 outline-gray-600 text-center font-medium py-4"
  >
    <span class="text-gray-200">© 2023 Kyle Lukaszek. All rights reserved.</span
    >
  </div>
</div>
