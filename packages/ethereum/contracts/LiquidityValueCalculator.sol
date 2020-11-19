pragma solidity ^0.6.6;

import "./interfaces/ILiquidityValueCalculator.sol";
import "@uniswap/v2-periphery/contracts/libraries/UniswapV2Library.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";

contract LiquidityValueCalculator is ILiquidityValueCalculator {
    address public factory;

    constructor(address factory_) public {
        factory = factory_;
    }

    function pairInfo(address tokenA, address tokenB)
        internal
        view
        returns (
            uint256 reserveA,
            uint256 reserveB,
            uint256 totalSupply
        )
    {
        IUniswapV2Pair pair = IUniswapV2Pair(
            UniswapV2Library.pairFor(factory, tokenA, tokenB)
        );
        totalSupply = pair.totalSupply();
        (uint256 reserves0, uint256 reserves1, ) = pair.getReserves();
        (reserveA, reserveB) = tokenA == pair.token0()
            ? (reserves0, reserves1)
            : (reserves1, reserves0);
    }

    function computeLiquidityShareValue(
        uint256 liquidity,
        address tokenA,
        address tokenB
    ) external override returns (uint256 tokenAAmount, uint256 tokenBAmount) {
        revert("TODO");
    }
}
