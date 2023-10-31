<script lang='ts'>

    import "../app.css";
    import { base } from '$app/paths';

    // State to keep track of the current page
    let currentPage:string = 'home';
  
    // Function to handle page navigation
    const navigateTo = (page:string) => {
      currentPage = page;
    };

</script>
  
<!-- Top navigation bar -->
<div class="bg-gray-100 h-screen flex flex-col">
  <div class="bg-white shadow">
    <div class="container mx-auto flex justify-between items-center py-4">
      <!-- Site title -->
      <div class="text-2xl font-bold">Your Name</div>
      <!-- Navigation links -->
      <div class="space-x-4">
        <a
          class="text-gray-800 hover:text-gray-600 cursor-pointer"
          on:click={() => navigateTo('home')}
        >
          Home
        </a>
        <a
          class="text-gray-800 hover:text-gray-600 cursor-pointer"
          on:click={() => navigateTo('about')}
        >
          About
        </a>
        <a
          class="text-gray-800 hover:text-gray-600 cursor-pointer"
          on:click={() => navigateTo('projects')}
        >
          Projects
        </a>
      </div>
    </div>
  </div>

  <!-- Main content area -->
  <div class="container mx-auto flex-1 flex items-center justify-center">
    {#if currentPage === 'home'}
      <div class="text-4xl">Welcome to My Personal Site!</div>
    {:else if currentPage === 'about'}
      <div class="text-4xl">About Me</div>
    {:else if currentPage === 'projects'}
      <div class="text-4xl">My Projects</div>
    {/if}
  </div>

  <!-- Footer section -->
  <div class="bg-gray-200 text-center py-4">
    <span class="text-gray-600">© 2023 Kyle Lukaszek. All rights reserved.</span>
  </div>
</div>