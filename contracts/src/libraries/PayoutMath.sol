// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @title PayoutMath
/// @notice Pure accounting for no-loss markets (DESIGN.md §5).
/// @dev Rounding always favours the contract: refunds and shares round down, the reserve
///      rounds up. Together with a rate that never decreases this keeps payouts ≤ holdings.
library PayoutMath {
    /// @notice Fixed-point scale of the stNEAR rate and of stNEAR itself.
    uint256 internal constant ONE = 1e24;

    /// @notice NEAR value of `staked` stNEAR at `rate`.
    function principalOf(uint256 staked, uint256 rate) internal pure returns (uint256) {
        return Math.mulDiv(staked, rate, ONE);
    }

    /// @notice Time weight of a bet placed at `nowTs` on a market closing at `closeTime`.
    function weightOf(uint256 principal, uint256 nowTs, uint256 closeTime)
        internal
        pure
        returns (uint256)
    {
        return principal * (closeTime - nowTs);
    }

    /// @notice stNEAR set aside at settlement to return every principal.
    function reserveOf(uint256 totalPrincipal, uint256 settlementRate)
        internal
        pure
        returns (uint256)
    {
        return Math.mulDiv(totalPrincipal, ONE, settlementRate, Math.Rounding.Ceil);
    }

    /// @notice stNEAR that returns `principal` NEAR at `settlementRate`.
    function refundOf(uint256 principal, uint256 settlementRate) internal pure returns (uint256) {
        return Math.mulDiv(principal, ONE, settlementRate);
    }

    /// @notice Everything above the reserve, plus sponsors: the yield the winners split.
    function potOf(uint256 totalStaked, uint256 reserve, uint256 sponsored)
        internal
        pure
        returns (uint256)
    {
        return (totalStaked > reserve ? totalStaked - reserve : 0) + sponsored;
    }

    /// @notice A bettor's cut of `pot` by time weight.
    function shareOf(uint256 pot, uint256 weight, uint256 totalWeight)
        internal
        pure
        returns (uint256)
    {
        return totalWeight == 0 ? 0 : Math.mulDiv(pot, weight, totalWeight);
    }
}
