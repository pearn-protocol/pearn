// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice The side a bettor takes.
enum Side {
    Yes,
    No
}

/// @notice A market's outcome. `Unresolved` until the resolver (or a void) settles it.
enum Outcome {
    Unresolved,
    Yes,
    No,
    Invalid
}

/// @notice Totals for one side of a market, or one bettor's position on a side.
/// @param staked    stNEAR deposited (raw units, 1e24 per token).
/// @param principal NEAR value of `staked` at bet time (yoctoNEAR), owed back in full.
/// @param weight    Σ principal × seconds until close: the claim on the pot.
struct Stake {
    uint128 staked;
    uint128 principal;
    uint256 weight;
}

/// @notice A prediction market. Settlement fields are zero until it resolves.
struct Market {
    address creator;
    address resolver;
    uint64 closeTime;
    uint64 resolvedAt;
    Outcome outcome;
    uint128 sponsored;
    uint128 pot;
    uint256 settlementRate;
    Stake yes;
    Stake no;
    string question;
}
