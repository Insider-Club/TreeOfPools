//SPDX-License-Identifier: GNU GPLv3
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "../contracts/Proxy.sol";
import "../contracts/Ranking.sol";
import "../contracts/BOP.sol";

/// @title The root of the poole tree. Allows you to close control of a large
/// number of pools to 1 address. Simplifies user interaction with a large number of pools.
/// @author Nethny
/// @dev Must be the owner of child contracts, to short-circuit the administrative
/// rights to one address.
contract RootOfPools_v013 is Initializable, OwnableUpgradeable {
    using AddressUpgradeable for address;
    using Strings for uint256;

    struct Pool {
        address pool;
        string name;
    }

    mapping(string => address) private _poolsTable;
    mapping(address => bool) private _imageTable;

    address public _usdAddress;
    address public _rankingAddress;

    Pool[] public Pools;

    address[] public Images;

    event PoolCreated(string name, address pool);
    event ImageAdded(address image);

    modifier shouldExist(string calldata name) {
        require(
            _poolsTable[name] != address(0),
            "ROOT: Selected pool does not exist!"
        );
        _;
    }

    /// @notice Replacement of the constructor to implement the proxy
    function initialize(address usdAddress, address rankingAddress)
        external
        initializer
    {
        require(
            usdAddress != address(0),
            "INIT: The usdAddress must not be zero."
        );
        require(
            rankingAddress != address(0),
            "INIT: The rankingAddress must not be zero."
        );

        __Ownable_init();
        _usdAddress = usdAddress;
        _rankingAddress = rankingAddress;
    }

    /// @notice Returns the address of the usd token in which funds are collected
    function getUSDAddress() external view returns (address) {
        return _usdAddress;
    }

    function addImage(address image) external onlyOwner {
        require(_imageTable[image] != true);

        Images.push(image);
        _imageTable[image] = true;

        emit ImageAdded(image);
    }

    /// @notice Returns the linked branch contracts
    function getPools() external view returns (Pool[] memory) {
        return Pools;
    }

    /// @notice Allows you to attach a new pool (branch contract)
    /// @dev Don't forget to run the init function
    function createPool(
        string calldata name,
        uint256 imageNumber,
        bytes calldata data
    ) external onlyOwner {
        require(
            imageNumber <= Images.length,
            "ROOT: Such an image does not exist"
        );
        require(
            _poolsTable[name] == address(0),
            "ROOT: Pool with this name already exists!"
        );

        TransparentProxy pool = new TransparentProxy(Images[imageNumber], data);

        address addrPool = address(pool);

        _poolsTable[name] = addrPool;

        Pool memory poolT = Pool(addrPool, name);
        Pools.push(poolT);

        emit PoolCreated(name, addrPool);
    }

    event Response(address to, bool success, bytes data);

    /*
    // Let's imagine that contract B does not have the source code for
    // contract A, but we do know the address of A and the function to call.
    function testCallFoo(address payable _addr) public payable {
        // You can send ether and specify a custom gas amount
        (bool success, bytes memory data) = _addr.call{value: msg.value, gas: 5000}(
            abi.encodeWithSignature("foo(string,uint256)", "call foo", 123)
        );

        emit Response(success, data);*/

    function Calling(string calldata name, bytes calldata dataIn)
        external
        onlyOwner
        shouldExist(name)
    {
        address dst = _poolsTable[name];
        (bool success, bytes memory data) = dst.call(dataIn);

        emit Response(dst, success, data);
    }

    function claimName(string calldata name) external shouldExist(name) {
        BranchOfPools(_poolsTable[name]).claim();
    }

    function claimAddress(address pool) internal {
        require(pool != address(0), "ROOT: Selected pool does not exist!");

        BranchOfPools(pool).claim();
    }

    function prepClaimAll(address user)
        external
        view
        returns (address[] memory pools)
    {
        address[] memory out;
        for (uint256 i; i < Pools.length; i++) {
            if (BranchOfPools(Pools[i].pool).isClaimable(user)) {
                out[i] = Pools[i].pool;
            }
        }

        return pools;
    }

    ///@dev To find out the list of pools from which a user can mine something,
    ///     use the prepClaimAll function
    function claimAll(address[] calldata pools) external {
        for (uint256 i; i < pools.length; i++) {
            claimAddress(pools[i]);
        }
    }

    function checkAllClaims(address user) external view returns (uint256) {
        uint256 temp;
        for (uint256 i; i < Pools.length; i++) {
            temp += (BranchOfPools(Pools[i].pool).myCurrentAllocation(user));
        }

        return temp;
    }

    function getAllocations(address user, uint256 step)
        external
        view
        returns (uint256[10] memory)
    {
        uint256[10] memory amounts;
        for (
            uint256 i;
            (i + 10 * step < (step + 1) * 10) && (i + 10 * step < Pools.length);
            i++
        ) {
            amounts[i] = (BranchOfPools(Pools[i].pool).myAllocation(user));
        }
        return amounts;
    }

    function getState(string calldata name)
        external
        view
        shouldExist(name)
        returns (BranchOfPools.State)
    {
        return BranchOfPools(_poolsTable[name])._state();
    }

    function getRanks() external view returns (address) {
        return _rankingAddress;
    }
}
