// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {
    AuroraSdk,
    NEAR,
    PromiseCreateArgs,
    PromiseResult,
    PromiseResultStatus,
    PromiseWithCallback
} from "aurora-sdk/AuroraSdk.sol";

import {IRateOracle} from "./interfaces/IRateOracle.sol";
import {NearJson} from "./libraries/NearJson.sol";

/// @title StNearRateOracle
/// @notice Reads stNEAR's NEAR value straight from Meta Pool on NEAR through Aurora's
///         cross-contract-call (XCC) precompile. Anyone may `sync`; only this contract's own
///         XCC account can deliver the answer, and the rate never decreases.
/// @dev The first `sync` creates this contract's XCC account on NEAR, which costs 2 NEAR of
///      storage: the first caller must have approved 2 wNEAR to this contract. Later syncs are
///      free view calls.
contract StNearRateOracle is IRateOracle {
    using AuroraSdk for NEAR;
    using AuroraSdk for PromiseCreateArgs;
    using AuroraSdk for PromiseWithCallback;
    using SafeCast for uint256;

    /// @notice NEAR gas for the `get_st_near_price` view.
    uint64 public constant VIEW_GAS = 10_000_000_000_000;
    /// @notice NEAR gas for the callback into Aurora, as in Aurora's own XCC examples.
    uint64 public constant CALLBACK_GAS = 130_000_000_000_000;

    /// @notice EVM address the XCC router calls `onRate` from.
    address public immutable callbackCaller;
    /// @notice Meta Pool's NEAR account, e.g. `meta-pool.near`.
    string public metaPool;

    /// @inheritdoc IRateOracle
    uint256 public rate;
    /// @inheritdoc IRateOracle
    uint64 public updatedAt;

    NEAR public near;

    event SyncRequested(address indexed caller);
    event RateUpdated(uint256 rate);
    event RateRejected(uint256 reading, uint256 current);
    event SyncFailed();

    error EmptyAccountId();
    error NotCallback();

    /// @param wNear         wNEAR ERC-20 the engine uses for XCC deposits.
    /// @param metaPool_     Meta Pool's NEAR account id.
    /// @param engineAccount Aurora engine's NEAR account id (`aurora` on mainnet and testnet).
    constructor(IERC20 wNear, string memory metaPool_, string memory engineAccount) {
        if (bytes(metaPool_).length == 0 || bytes(engineAccount).length == 0) {
            revert EmptyAccountId();
        }
        metaPool = metaPool_;
        near = AuroraSdk.initNear(wNear);
        callbackCaller = AuroraSdk.implicitAuroraAddress(
            AuroraSdk.addressSubAccount(address(this), engineAccount)
        );
    }

    /// @notice Asks Meta Pool for the current rate; the answer arrives in `onRate`.
    function sync() external {
        emit SyncRequested(msg.sender);
        PromiseCreateArgs memory query = near.call(metaPool, "get_st_near_price", "{}", 0, VIEW_GAS);
        PromiseCreateArgs memory callback =
            near.auroraCall(address(this), abi.encodeCall(this.onRate, ()), 0, CALLBACK_GAS);
        query.then(callback).transact();
    }

    /// @notice XCC callback with the result of `get_st_near_price`.
    /// @dev A failed view or a lower reading leaves the rate as it was. An equal reading
    ///      refreshes `updatedAt`, since it proves the rate is still current.
    function onRate() external {
        if (msg.sender != callbackCaller) revert NotCallback();

        PromiseResult memory result = AuroraSdk.promiseResult(0);
        if (result.status != PromiseResultStatus.Successful) {
            // Only the promise-result precompile precedes this; precompiles cannot reenter.
            // forge-lint: disable-next-line(reentrancy-events)
            emit SyncFailed();
            return;
        }

        uint256 reading = NearJson.parseU128(result.output);
        if (reading < rate) {
            // Only the promise-result precompile precedes this; precompiles cannot reenter.
            // forge-lint: disable-next-line(reentrancy-events)
            emit RateRejected(reading, rate);
            return;
        }

        rate = reading;
        updatedAt = block.timestamp.toUint64();
        // Only the promise-result precompile precedes this; precompiles cannot reenter.
        // forge-lint: disable-next-line(reentrancy-events)
        emit RateUpdated(reading);
    }
}
