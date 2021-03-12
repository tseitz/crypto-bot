<script lang="typescript">
  import { onMount } from "svelte";
  import { Router, Link, Route } from "svelte-routing";
  import Home from "./routes/Home.svelte";
  import Kraken from "./routes/Kraken.svelte";

  export let url = "";

  let result: string = "";

  let count: number = 0;
  onMount(async () => {
    const interval = setInterval(() => count++, 1000);

    await getOpenPositions();

    return () => {
      clearInterval(interval);
    };
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

<Router url="{url}">
  <nav>
    <Link to="/">Home</Link>
    <Link to="kraken">Kraken</Link>
  </nav>
  <div>
    <Route path="kraken" component="{Kraken}" />
    <Route path="/"><Home /></Route>
  </div>
</Router>