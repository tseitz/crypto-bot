<script lang="typescript">
  interface CoinBalance {
    [index: string]: number;
  }

  async function getBalance() {
    const res = await fetch(
      "http://localhost:3000/api/kraken/getBalance",
      {
        method: "GET"
      }
    );

    const { balances }: { balances: CoinBalance } = await res.json();
    
    const sortable: [[string, number]] = [['', 0]];
    for (const balance in balances) {
      sortable.push([balance, balances[balance]]);
    }

    return sortable.sort((a, b) => {
      return b[1] - a[1];
    });
  }

  async function getTradeBalance() {
    const res = await fetch(
      "http://localhost:3000/api/kraken/getTradeBalance",
      {
        method: "GET"
      }
    );

    const { balances } = await res.json();

    return balances.totalBalances;
  }
</script>

<br/>

<h2>Balances</h2>

{#await getTradeBalance()}
	<p>...loading trade balance</p>
{:then tradeBalanceResult}
  <h1>{tradeBalanceResult}</h1>
{:catch error}
	<p style="color: red">{error.message}</p>
{/await}

<br/>

{#await getBalance()}
	<p>...loading balances</p>
{:then balanceResult}
  {#each balanceResult as balance}
    {#if balance[1] > 0}
      {balance[0]} : {balance[1]}<br/>
    {/if}
  {/each}
{:catch error}
	<p style="color: red">{error.message}</p>
{/await}