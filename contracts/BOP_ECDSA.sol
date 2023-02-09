//SPDX-License-Identifier: GNU GPLv3
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "../contracts/ROP.sol";

/// @title The pool's subsidiary contract for fundraising.
/// This contract collects funds, distributes them, and charges fees
/// @author Nethny
/// @dev This contract pulls commissions and other parameters from the Ranking contract.
/// Important: Agree on the structure of the ranking parameters and this contract!
/// Otherwise the calculations can be wrong!
contract BranchOfPools_ECDSA is Initializable {
    using Address for address;
    using Strings for uint256;
    using ECDSA for bytes32;

    enum State {
        Pause,
        Fundrasing,
        WaitingToken,
        TokenDistribution,
        Emergency
    }
    State public _state = State.Pause;

    // //Events
    // event Deposit(address user, uint256 amount);
    // event Claim(address user);
    // event FundraisingOpened();
    // event FundraisingClosed();
    // event TokenEntrusted(address addrToken, uint256 amount);
    // event EmergencyStoped();
    // event FundsReturned(address user, uint256 amount);

    address public _owner;
    address private _root;

    uint256 public _stepValue;
    uint256 public _VALUE;
    uint256 private _decimals;
    uint256 public _outCommission;
    uint256 public _preSend;

    uint256 public _CURRENT_VALUE;
    uint256 public _FUNDS_RAISED;
    uint256 public _CURRENT_COMMISSION;
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

    address public _mainSigner;

    modifier onlyOwner() {
        require(msg.sender == _owner);
        _;
    }

    /*function transferOwnership(address newOwner) public virtual onlyOwner {
        require(
            newOwner != address(0),
            "Ownable: new owner is the zero address"
        );
        _owner = newOwner;
    }*/

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
        address tokenUSD,
        address mainSigner
    ) external initializer {
        require(Root != address(0));
        require(devUSDAddress != address(0));

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

        _mainSigner = mainSigner;
    }

    /// @notice Changes the target amount of funds we collect
    /// @param value - the new target amount of funds raised
    function changeTargetValue(
        uint256 value
    )
        external
        onlyOwner
        onlyNotState(State.TokenDistribution)
        onlyNotState(State.WaitingToken)
    {
        _VALUE = value;
    }

    /// @notice Changes the step with which we raise funds
    /// @param step - the new step
    function changeStepValue(
        uint256 step
    )
        external
        onlyOwner
        onlyNotState(State.TokenDistribution)
        onlyNotState(State.WaitingToken)
    {
        _stepValue = step;
    }

    modifier onlyState(State state) {
        require(_state == state);
        _;
    }

    modifier onlyNotState(State state) {
        require(_state != state);
        _;
    }

    /// @notice Opens fundraising
    function startFundraising() external onlyOwner onlyState(State.Pause) {
        _state = State.Fundrasing;

        // emit FundraisingOpened();
    }

    //TODO
    /// @notice Termination of fundraising and opening the possibility of refunds to depositors
    function stopEmergency()
        external
        onlyOwner
        onlyNotState(State.Pause)
        onlyNotState(State.TokenDistribution)
    {
        if (_state == State.WaitingToken) {
            uint256 balance = ERC20(_usd).balanceOf(address(this));
            require(balance >= _FUNDS_RAISED + _CURRENT_COMMISSION);
        }

        _state = State.Emergency;

        // emit EmergencyStoped();
    }

    //TODO
    /// @notice Returns the deposited funds to the caller
    /// @dev This is a bad way to write a transaction check,
    /// but in this case we are forced not to use require because of the usdt token implementation,
    /// which does not return a result. And to keep flexibility in terms of using different ERC20,
    /// we have to do it :\
    function paybackEmergency() external onlyState(State.Emergency) {
        uint256 usdT = _usdEmergency[tx.origin];

        _usdEmergency[tx.origin] = 0;

        if (usdT == 0) {
            revert();
        }

        uint256 beforeBalance = ERC20(_usd).balanceOf(tx.origin);

        // emit FundsReturned(tx.origin, usdT);

        ERC20(_usd).transfer(tx.origin, usdT);

        uint256 afterBalance = ERC20(_usd).balanceOf(tx.origin);

        require(
            beforeBalance + usdT == afterBalance,
            "PAYBACK: Something went wrong."
        );
    }

    /// @notice The function of the deposit of funds.
    /// @dev The contract attempts to debit the user's funds in the specified amount in the token whose contract is located at _usd
    /// the amount must be approved for THIS address
    /// @param amount - The number of funds the user wants to deposit
    function deposit(
        uint256 amount,
        bytes memory signature
    ) external onlyState(State.Fundrasing) {
        bytes32 hash = keccak256(
            abi.encode(
                keccak256("deposit(uint256 amount)"),
                tx.origin,
                address(this),
                amount
            )
        );

        bytes32 Hash = hash.toEthSignedMessageHash();
        require(_mainSigner == Hash.recover(signature));

        uint256 commission;
        uint256[] memory rank = Ranking(RootOfPools_v2(_root)._rankingAddress())
            .getParRankOfUser(tx.origin);
        if (rank[2] != 0) {
            commission = (amount * rank[2]) / 100; //[Min, Max, Commission]
        }
        uint256 Min = _decimals * rank[0];
        uint256 Max = _decimals * rank[1];

        if (rank[2] == 0) {
            _withoutCommission[tx.origin] = true;
        }

        require(amount >= Min);
        require(amount + _valueUSDList[tx.origin] <= Max);

        require((amount) % _stepValue == 0);
        require(_CURRENT_VALUE + amount - commission <= _VALUE);

        // emit Deposit(tx.origin, amount);

        uint256 pre_balance = ERC20(_usd).balanceOf(address(this));

        require(ERC20(_usd).allowance(tx.origin, address(this)) >= amount);

        require(ERC20(_usd).transferFrom(tx.origin, address(this), amount));
        _usdEmergency[tx.origin] += amount;

        if (_valueUSDList[tx.origin] == 0) {
            _listParticipants.push(tx.origin);
        }

        _valueUSDList[tx.origin] += amount - commission;
        _CURRENT_COMMISSION += commission;
        _CURRENT_VALUE += amount - commission;

        require(pre_balance + amount == ERC20(_usd).balanceOf(address(this)));

        if (_CURRENT_VALUE == _VALUE) {
            _state = State.WaitingToken;
            // emit FundraisingClosed();
        }
    }

    function preSend(
        uint256 amount
    ) external onlyOwner onlyState(State.Fundrasing) {
        require(amount < _CURRENT_VALUE - _preSend);

        _preSend += amount;

        require(ERC20(_usd).transfer(_devUSDAddress, amount));
    }

    //TODO
    /// @notice Closes the fundraiser and distributes the funds raised
    /// Allows you to close the fundraiser before the fundraising amount is reached
    function stopFundraising()
        external
        onlyOwner
        onlyNotState(State.Pause)
        onlyNotState(State.TokenDistribution)
        onlyNotState(State.Emergency)
    {
        if (_state == State.Fundrasing) {
            _state = State.WaitingToken;
            _FUNDS_RAISED = _CURRENT_VALUE;
            _VALUE = _CURRENT_VALUE;
            _CURRENT_VALUE = 0;

            // emit FundraisingClosed();
        } else {
            require(_CURRENT_VALUE == _VALUE);

            _FUNDS_RAISED = _CURRENT_VALUE;
            _CURRENT_VALUE = 0;
        }

        //Send to devs
        require(ERC20(_usd).transfer(_devUSDAddress, _FUNDS_RAISED - _preSend));
    }

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
        require(tokenAddr != address(0));

        if (_token == address(0)) {
            _token = tokenAddr;
        } else {
            require(tokenAddr == _token);
        }

        _state = State.TokenDistribution;
    }

    //TODO
    /// @notice Allows users to brand the distributed tokens
    function claim() external onlyState(State.TokenDistribution) {
        require(_usdEmergency[tx.origin] > 0);

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
            // emit Claim(tx.origin);
            uint256 pre_balance = ERC20(_token).balanceOf(address(this));

            require(ERC20(_token).transfer(tx.origin, amount), "CT");

            require(
                ERC20(_token).balanceOf(address(this)) == pre_balance - amount
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
        if (
            ((_state == State.WaitingToken) ||
                (_state == State.TokenDistribution)) && (!_getCommissionFlag)
        ) {
            //Send to fund
            uint256 toFund = (_FUNDS_RAISED * _fundCommission) / 100;
            _fundValue = (toFund * 40) / 100;
            require(ERC20(_usd).transfer(_fundAddress, toFund - _fundValue));

            //Send to admin
            uint256 amount = ERC20(_usd).balanceOf(address(this)) - _fundValue;
            require(
                ERC20(_usd).transfer(RootOfPools_v2(_root).owner(), amount / 2)
            );

            _getCommissionFlag = true;
        }

        if (_fundLock) {
            if (_fundValue != 0) {
                uint256 balance = ERC20(_usd).balanceOf(address(this));
                if (balance != 0) {
                    uint256 amount = balance - _fundValue;
                    if (amount != 0) {
                        require(
                            ERC20(_usd).transfer(
                                RootOfPools_v2(_root)._marketingWallet(),
                                ERC20(_usd).balanceOf(address(this)) -
                                    _fundValue
                            )
                        );
                    }

                    uint256 temp = _fundValue;
                    _fundValue = 0;

                    if (temp != 0) {
                        require(ERC20(_usd).transfer(_fundAddress, temp), "CF");
                    }
                }
            }

            //========================================================== TOKЕN
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
                    )
                );
            }

            if (toMarketing != 0) {
                require(
                    ERC20(_token).transfer(
                        RootOfPools_v2(_root)._marketing(),
                        toMarketing //точно?
                    )
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
                    )
                );

                require(
                    ERC20(_token).transfer(
                        RootOfPools_v2(_root)._marketingWallet(),
                        temp / 2
                    )
                );
            }
        }
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
}
