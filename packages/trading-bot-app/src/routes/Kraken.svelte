<script lang="typescript">
  async function getOpenPositions() {
    const res = await fetch(
      "http://localhost:3000/api/kraken/getOpenPositions",
      {
        method: "GET"
      }
    );

    const { openPositions } = await res.json();
    console.log(openPositions);

    return openPositions;
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


<h1>Longs</h1>
<div class="table-header"></div>

{#await getOpenPositions()}
	<p>...loading open positions</p>
{:then openPositions}
  {#each Object.entries(openPositions) as [key, val]}
    {key}: {JSON.stringify(val)}
  {/each}
{:catch error}
	<p style="color: red">{error.message}</p>
{/await}


<h1>Shorts</h1>
<div class="table-header"></div>