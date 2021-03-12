<script lang="typescript">
  import { onMount } from "svelte";

  let result: string = "";

  onMount(async () => {
    await getOpenPositions();
  });

  async function getOpenPositions() {
    const res = await fetch(
      "http://localhost:3000/api/kraken/getOpenPositions",
      {
        method: "GET"
      }
    );

    const json = await res.json();
    result = JSON.stringify(json);

    return result;
  }
</script>

<style>
  h1 {
   font-size: 2em;
   /* font-weight: bold; */
  }
  .table-header {
    height: 74px;
    width: 1024px;
    background-color: theme('colors.kraken');
  }
</style>


<h1>Longs</h1>
<div class="table-header"></div>


<h1>Shorts</h1>
<div class="table-header"></div>