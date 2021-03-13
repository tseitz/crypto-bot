<script lang="typescript">
import { fix_position } from "svelte/internal";

  async function getOpenPositions() {
    const res = await fetch(
      "http://localhost:3000/api/kraken/getOpenPositions",
      {
        method: "GET"
      }
    );

    const { openPositions } = await res.json();
    
    const openPositionArr = [];
    for (const key in openPositions) {
      openPositionArr.push(openPositions[key]);
    }

    return openPositionArr;
  }
</script>

<style>
  h1 {
   font-size: 2em;
  }
  .table-header {
    height: 74px;
    width: 1024px;
    background-color: theme('colors.kraken');
  }
</style>


<div class="md:container md:mx-auto">
  <div class="flex justify-center">
    <img src="kraken-logo.png" alt="Kraken" height="150" width="150">
  </div>

  <div>
    <h1>Longs</h1>
    <div class="table-header"></div>
    
    {#await getOpenPositions()}
      <p>...loading open positions</p>
    {:then openPositions}
      {#each openPositions as position}
        {position.pair} : {position.margin} : {position.cost} <br />
      {/each}
    {:catch error}
      <p style="color: red">{error.message}</p>
    {/await}
    
    
    <h1>Shorts</h1>
    <div class="table-header"></div>
  </div>
</div>
