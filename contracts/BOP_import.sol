//SPDX-License-Identifier: GNU GPLv3
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "../contracts/ROP.sol";

/// @title The pool's subsidiary contract for fundraising.
/// This contract collects funds, distributes them, and charges fees
/// @author Nethny
/// @dev This contract pulls commissions and other parameters from the Ranking contract.
/// Important: Agree on the structure of the ranking parameters and this contract!
/// Otherwise the calculations can be wrong!
contract BranchOfPools_import is Initializable {
    using Address for address;
    using Strings for uint256;

    enum State {
        Pause,
        Fundrasing,
        WaitingToken,
        TokenDistribution,
        Emergency
    }
    State public _state = State.Pause;

    //Events
    event Deposit(address user, uint256 amount);
    event Claim(address user);
    event FundraisingOpened();
    event FundraisingClosed();
    event TokenEntrusted(address addrToken, uint256 amount);
    event EmergencyStoped();
    event FundsReturned(address user, uint256 amount);

    address public _owner;
    address private _root;

    uint256 public _stepValue;
    uint256 public _VALUE;
    uint256 private _decimals;
    uint256 public _outCommission;
    uint256 public _preSend;

    uint256 public _CURRENT_COMMISSION;
    uint256 public _CURRENT_VALUE;
    uint256 public _FUNDS_RAISED;
    uint256 public _CURRENT_VALUE_TOKEN;
    uint256 public _DISTRIBUTED_TOKEN;
    uint256 public _TOKEN_COMMISSION;

    mapping(address => uint256) public _valueUSDList;
    mapping(address => uint256) public _usdEmergency;
    mapping(address => uint256) public _issuedTokens;
    mapping(address => bool) public _withoutCommission;

    address[] public _listParticipants;

    address public _usd;
    address public _token;
    address public _devUSDAddress;

    address public _fundAddress;
    bool private _fundLock = false;
    uint256 private _fundValue;
    uint256 public _fundCommission;

    bool private _getCommissionFlag;

    modifier onlyOwner() {
        require(msg.sender == _owner, "Ownable: Only owner");
        _;
    }

    /// @notice Assigns the necessary values to the variables
    /// @dev Just a constructor
    /// You need to call init()
    /// @param Root - RootOfPools contract address
    /// @param VALUE - The target amount of funds we collect
    /// @param Step - The step with which we raise funds
    /// @param devUSDAddress - The address of the developers to which they will receive the collected funds
    function init(
        address Root,
        uint256 VALUE,
        uint256 Step,
        address devUSDAddress,
        address fundAddress,
        uint256 fundCommission,
        uint256 outCommission,
        address tokenUSD
    ) external initializer {
        require(Root != address(0), "The root address must not be zero.");
        require(
            devUSDAddress != address(0),
            "The devUSDAddress must not be zero."
        );

        _owner = msg.sender;
        _root = Root;
        _usd = tokenUSD;
        _decimals = 10 ** ERC20(_usd).decimals();
        _VALUE = VALUE * _decimals;
        _stepValue = Step * _decimals;
        _devUSDAddress = devUSDAddress;
        _fundAddress = fundAddress;
        _fundCommission = fundCommission;
        _outCommission = outCommission;
    }

    modifier onlyState(State state) {
        require(_state == state, "STATE: It's impossible to do it now.");
        _;
    }

    modifier onlyNotState(State state) {
        require(_state != state, "STATE: It's impossible to do it now.");
        _;
    }

    //Import

    //TODO
    /// @notice Allows you to transfer data about pool members
    /// This is necessary to perform token distribution in another network
    /// @dev the arrays of participants and their investments must be the same size.
    /// Make sure that the order of both arrays is correct,
    /// if the order is wrong, the resulting investment table will not match reality
    /// @param usersData - Participant array
    /// @param usersAmount - The size of participants' investments
    function importTable(
        address[] calldata usersData,
        uint256[] calldata usersAmount,
        bool[] calldata commissions
    ) external onlyState(State.Pause) onlyOwner returns (bool) {
        require(
            usersData.length == usersAmount.length,
            "IMPORT: The number not match!"
        );

        for (uint256 i; i < usersData.length; i++) {
            _usdEmergency[usersData[i]] += usersAmount[i];
            _withoutCommission[usersData[i]] = commissions[i];
            _listParticipants.push(usersData[i]);
        }

        return true;
    }

    //TODO
    /// @notice Allows you to transfer data about pool members
    /// This is necessary to perform token distribution in another network
    /// @param fundsRaised - Number of funds raised
    function importFR(
        uint256 fundsRaised
    ) external onlyState(State.Pause) onlyOwner returns (bool) {
        _FUNDS_RAISED = fundsRaised;
        return true;
    }

    function importCC(
        uint256 currentCommission
    ) external onlyState(State.Pause) onlyOwner returns (bool) {
        _CURRENT_COMMISSION = currentCommission;
        return true;
    }

    //TODO
    /// @notice Allows you to transfer data about pool members
    /// This is necessary to perform token distribution in another network
    function closeImport()
        external
        onlyState(State.Pause)
        onlyOwner
        returns (bool)
    {
        _state = State.WaitingToken;

        return true;
    }

    //End Import

    /// @notice Allows developers to transfer tokens for distribution to contributors
    /// @dev This function is only called from the developers address _devInteractionAddress
    /// @param tokenAddr - Developer token address
    function entrustToken(
        address tokenAddr
    )
        external
        onlyOwner
        onlyNotState(State.Emergency)
        onlyNotState(State.Fundrasing)
        onlyNotState(State.Pause)
    {
        require(
            tokenAddr != address(0),
            "ENTRUST: The tokenAddr must not be zero."
        );

        if (_token == address(0)) {
            _token = tokenAddr;
        } else {
            require(
                tokenAddr == _token,
                "ENTRUST: The tokens have only one contract"
            );
        }

        _state = State.TokenDistribution;
    }

    /// @notice Allows users to brand the distributed tokens
    function claim() external onlyState(State.TokenDistribution) {
        require(
            _usdEmergency[tx.origin] > 0,
            "CLAIM: You have no unredeemed tokens!"
        );

        uint256 amount;

        uint256 currentTokenBalance = ERC20(_token).balanceOf(address(this));

        if (_CURRENT_VALUE_TOKEN < currentTokenBalance) {
            _CURRENT_VALUE_TOKEN += currentTokenBalance - _CURRENT_VALUE_TOKEN;
        }

        if (_withoutCommission[tx.origin]) {
            amount =
                (
                    ((_usdEmergency[tx.origin] *
                        (_CURRENT_VALUE_TOKEN + _DISTRIBUTED_TOKEN)) /
                        _FUNDS_RAISED)
                ) -
                _issuedTokens[tx.origin];
        } else {
            amount =
                ((((_usdEmergency[tx.origin] *
                    (_CURRENT_VALUE_TOKEN + _DISTRIBUTED_TOKEN)) /
                    _FUNDS_RAISED) * _outCommission) / 100) -
                _issuedTokens[tx.origin];
        }

        _issuedTokens[tx.origin] += amount;
        _DISTRIBUTED_TOKEN += amount;
        _CURRENT_VALUE_TOKEN -= amount;

        if (amount > 0) {
            emit Claim(tx.origin);
            uint256 pre_balance = ERC20(_token).balanceOf(address(this));

            require(
                ERC20(_token).transfer(tx.origin, amount),
                "CLAIM: Transfer error"
            );

            require(
                ERC20(_token).balanceOf(address(this)) == pre_balance - amount,
                "CLAIM: Something went wrong!"
            );
        }

        if (_fundLock == false) {
            _fundLock = true;
            //getCommission();
        }
    }

    //TODO Add comments
    function getCommission()
        public
        onlyNotState(State.Fundrasing)
        onlyNotState(State.Pause)
        onlyNotState(State.Emergency)
    {
        if (_fundLock) {
            uint256 temp = 0;
            uint256 value = _CURRENT_VALUE_TOKEN + _DISTRIBUTED_TOKEN;
            for (uint256 i = 0; i < _listParticipants.length; i++) {
                address user = _listParticipants[i];
                if (_withoutCommission[user]) {
                    temp += (((_usdEmergency[user] * value) / _FUNDS_RAISED));
                } else {
                    temp += ((((_usdEmergency[user] * value) / _FUNDS_RAISED) *
                        _outCommission) / 100);
                }
            }

            uint256 tmp = ((_FUNDS_RAISED + _CURRENT_COMMISSION) * 15) / 100;

            uint256 toMarketing = ((tmp * value) / _FUNDS_RAISED) -
                _issuedTokens[address(0)];
            _issuedTokens[address(0)] += toMarketing;

            /*//_mamrktingOut == _issuedTokens[address(0)]
            uint256 toMarketing = ((value * 15) / 100) -
                _issuedTokens[address(0)]; //A?
            _issuedTokens[address(0)] += toMarketing;*/

            tmp = ((_FUNDS_RAISED + _CURRENT_COMMISSION) * 2) / 100;
            uint256 toTeam = ((tmp * value) / _FUNDS_RAISED) -
                _issuedTokens[address(1)];

            //uint256 toTeam = ((value * 2) / 100) - _issuedTokens[address(1)]; //B?
            _issuedTokens[address(1)] += toTeam;

            _DISTRIBUTED_TOKEN += toMarketing + toTeam;
            _CURRENT_VALUE_TOKEN -= (toMarketing + toTeam);

            temp =
                value -
                (temp + _issuedTokens[address(0)] + _issuedTokens[address(1)]) -
                _issuedTokens[address(this)];
            _issuedTokens[address(this)] += temp;

            if (toTeam != 0) {
                require(
                    ERC20(_token).transfer(
                        RootOfPools_v2(_root)._team(),
                        toTeam //точно?
                    ),
                    "GET: Transfer error"
                );
            }

            if (toMarketing != 0) {
                require(
                    ERC20(_token).transfer(
                        RootOfPools_v2(_root)._marketing(),
                        toMarketing //точно?
                    ),
                    "GET: Transfer error"
                );
            }
            //temp =
            if (temp != 0) {
                _DISTRIBUTED_TOKEN += temp;
                _CURRENT_VALUE_TOKEN -= temp;
                require(
                    ERC20(_token).transfer(
                        RootOfPools_v2(_root).owner(),
                        temp / 2
                    ),
                    "GET: Transfer error"
                );

                require(
                    ERC20(_token).transfer(
                        RootOfPools_v2(_root)._marketingWallet(),
                        temp / 2
                    ),
                    "GET: Transfer error"
                );
            }
        }
    }

    /// @notice Returns the amount of money that the user has deposited excluding the commission
    /// @param user - address user
    function myAllocation(address user) external view returns (uint256) {
        return _valueUSDList[user];
    }

    /// @notice Returns the amount of funds that the user deposited
    /// @param user - address user
    function myAllocationEmergency(
        address user
    ) external view returns (uint256) {
        return _usdEmergency[user];
    }

    /// @notice Returns the number of tokens the user can take at the moment
    /// @param user - address user
    function myCurrentAllocation(address user) public view returns (uint256) {
        if (_FUNDS_RAISED == 0) {
            return 0;
        }

        uint256 amount;
        if (_withoutCommission[user]) {
            amount =
                (
                    ((_usdEmergency[user] *
                        (_CURRENT_VALUE_TOKEN + _DISTRIBUTED_TOKEN)) /
                        _FUNDS_RAISED)
                ) -
                _issuedTokens[user];
        } else {
            amount =
                ((((_usdEmergency[user] *
                    (_CURRENT_VALUE_TOKEN + _DISTRIBUTED_TOKEN)) /
                    _FUNDS_RAISED) * _outCommission) / 100) -
                _issuedTokens[user];
        }

        return amount;
    }

    /// @notice Auxiliary function for RootOfPools claimAll
    /// @param user - address user
    function isClaimable(address user) external view returns (bool) {
        return myCurrentAllocation(user) > 0;
    }
}
