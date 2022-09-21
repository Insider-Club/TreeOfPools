// SPDX-License-Identifier: MIT

//Warning: This contract has been modified, additional security checks are required

pragma solidity ^0.8.2;

import "@openzeppelin/contracts/proxy/Proxy.sol";
import "./StorageForProxy.sol";

contract TransparentProxy is Proxy, ProxyS {
    /**
     * @dev Initializes the upgradeable proxy with an initial implementation specified by `_logic`.
     *
     * If `_data` is nonempty, it's used as data in a delegate call to `_logic`. This will typically be an encoded
     * function call, and allows initializing the storage of the proxy like a Solidity constructor.
     */
    constructor(address _logic, bytes memory _data) payable {
        __createToAndCall(_logic, _data, false);
    }

    /**
     * @dev Returns the current implementation address.
     */
    function _implementation()
        internal
        view
        virtual
        override
        returns (address impl)
    {
        return ProxyS._getImplementation();
    }
}
