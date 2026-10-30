// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title IRateOracle
/// @notice NEAR value of one stNEAR. The rate never decreases.
interface IRateOracle {
    /// @notice yoctoNEAR per 1 stNEAR (1e24 scale); zero before the first sync.
    function rate() external view returns (uint256);

    /// @notice Timestamp of the last successful reading.
    function updatedAt() external view returns (uint64);
}
