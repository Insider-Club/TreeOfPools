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
contract BranchOfPools is Initializable {
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

    modifier onlyOwner() {
        require(msg.sender == _owner, "Ownable: Only owner");
        _;
    }

    function transferOwnership(address newOwner) public virtual onlyOwner {
        require(
            newOwner != address(0),
            "Ownable: new owner is the zero address"
        );
        _owner = newOwner;
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
        uint256 outCommission
    ) external initializer {
        require(Root != address(0), "The root address must not be zero.");
        require(
            devUSDAddress != address(0),
            "The devUSDAddress must not be zero."
        );

        _owner = msg.sender;
        _root = Root;
        _usd = RootOfPools_v2(_root).getUSDAddress();
        _decimals = 10**ERC20(_usd).decimals();
        _VALUE = VALUE * _decimals;
        _stepValue = Step * _decimals;
        _devUSDAddress = devUSDAddress;
        _fundAddress = fundAddress;
        _fundCommission = fundCommission;
        _outCommission = outCommission;
    }

    /// @notice Changes the target amount of funds we collect
    /// @param value - the new target amount of funds raised
    function changeTargetValue(uint256 value)
        external
        onlyOwner
        onlyNotState(State.TokenDistribution)
        onlyNotState(State.WaitingToken)
    {
        _VALUE = value;
    }

    /// @notice Changes the step with which we raise funds
    /// @param step - the new step
    function changeStepValue(uint256 step)
        external
        onlyOwner
        onlyNotState(State.TokenDistribution)
        onlyNotState(State.WaitingToken)
    {
        _stepValue = step;
    }

    modifier onlyState(State state) {
        require(_state == state, "STATE: It's impossible to do it now.");
        _;
    }

    modifier onlyNotState(State state) {
        require(_state != state, "STATE: It's impossible to do it now.");
        _;
    }

    /// @notice Opens fundraising
    function startFundraising() external onlyOwner onlyState(State.Pause) {
        _state = State.Fundrasing;

        emit FundraisingOpened();
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
            require(
                balance >= _FUNDS_RAISED + _CURRENT_COMMISSION,
                "It takes money to get a refund"
            );
        }

        _state = State.Emergency;

        emit EmergencyStoped();
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
            revert("You have no funds to withdraw!");
        }

        uint256 beforeBalance = ERC20(_usd).balanceOf(tx.origin);

        emit FundsReturned(tx.origin, usdT);

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
    function deposit(uint256 amount) external onlyState(State.Fundrasing) {
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

        require(amount >= Min, "DEPOSIT: Too little funding!");
        require(
            amount + _valueUSDList[tx.origin] <= Max,
            "DEPOSIT: Too many funds!"
        );

        require((amount) % _stepValue == 0, "DEPOSIT: Must match the step!");
        require(
            _CURRENT_VALUE + amount - commission <= _VALUE,
            "DEPOSIT: Fundraising goal exceeded!"
        );

        emit Deposit(tx.origin, amount);

        uint256 pre_balance = ERC20(_usd).balanceOf(address(this));

        require(
            ERC20(_usd).allowance(tx.origin, address(this)) >= amount,
            "DEPOSIT: ALLOW ERROR"
        );

        require(
            ERC20(_usd).transferFrom(tx.origin, address(this), amount),
            "DEPOSIT: Transfer error"
        );
        _usdEmergency[tx.origin] += amount;

        if (_valueUSDList[tx.origin] == 0) {
            _listParticipants.push(tx.origin);
        }

        _valueUSDList[tx.origin] += amount - commission;
        _CURRENT_COMMISSION += commission;
        _CURRENT_VALUE += amount - commission;

        require(
            pre_balance + amount == ERC20(_usd).balanceOf(address(this)),
            "DEPOSIT: Something went wrong"
        );

        if (_CURRENT_VALUE == _VALUE) {
            _state = State.WaitingToken;
            emit FundraisingClosed();
        }
    }

    function preSend(uint256 amount)
        external
        onlyOwner
        onlyState(State.Fundrasing)
    {
        require(amount < _CURRENT_VALUE - _preSend);

        _preSend += amount;

        require(
            ERC20(_usd).transfer(_devUSDAddress, amount),
            "COLLECT: Transfer error"
        );
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

            emit FundraisingClosed();
        } else {
            require(
                _CURRENT_VALUE == _VALUE,
                "COLLECT: The funds have already been withdrawn."
            );

            _FUNDS_RAISED = _CURRENT_VALUE;
            _CURRENT_VALUE = 0;
        }

        //Send to devs
        require(
            ERC20(_usd).transfer(_devUSDAddress, _FUNDS_RAISED - _preSend),
            "COLLECT: Transfer error"
        );

        //Send to fund
        uint256 toFund = (_FUNDS_RAISED * _fundCommission) / 100;
        _fundValue = (toFund * 40) / 100;
        require(ERC20(_usd).transfer(_fundAddress, toFund - _fundValue), "");

        //Send to admin
        require(
            ERC20(_usd).transfer(
                RootOfPools_v2(_root).owner(),
                ERC20(_usd).balanceOf(address(this)) - _fundValue
            ),
            "COLLECT: Transfer error"
        );
    }

    /// @notice Allows developers to transfer tokens for distribution to contributors
    /// @dev This function is only called from the developers address _devInteractionAddress
    /// @param tokenAddr - Developer token address
    function entrustToken(address tokenAddr)
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
        uint256[] calldata usersAmount
    ) external onlyState(State.Pause) onlyOwner returns (bool) {
        require(
            usersData.length == usersAmount.length,
            "IMPORT: The number not match!"
        );

        for (uint256 i; i < usersData.length; i++) {
            _usdEmergency[usersData[i]] = usersAmount[i];
        }

        //Not all information is transferred to save gas
        //Implications: It is not possible to fully import data from here
        //To capture all the information you need to replenish this array with the right users
        //_listParticipants = usersData;

        return true;
    }

    //TODO
    /// @notice Allows you to transfer data about pool members
    /// This is necessary to perform token distribution in another network
    /// @param fundsRaised - Number of funds raised
    function importFR(uint256 fundsRaised)
        external
        onlyState(State.Pause)
        onlyOwner
        returns (bool)
    {
        _FUNDS_RAISED = fundsRaised;
        return true;
    }

    //TODO
    /// @notice Allows you to transfer data about pool members
    /// This is necessary to perform token distribution in another network
    /// @param collectedCommission - Number of commissions collected
    function importCC(uint256 collectedCommission)
        external
        onlyState(State.Pause)
        onlyOwner
        returns (bool)
    {
        _CURRENT_COMMISSION = collectedCommission;
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

    //TODO
    /// @notice Allows users to brand the distributed tokens
    function claim() external onlyState(State.TokenDistribution) {
        require(
            _valueUSDList[tx.origin] > 0,
            "CLAIM: You have no unredeemed tokens!"
        );

        uint256 amount;

        uint256 currentTokenBalance = ERC20(_token).balanceOf(address(this));

        if (_CURRENT_VALUE_TOKEN < currentTokenBalance) {
            uint256 temp = currentTokenBalance - _CURRENT_VALUE_TOKEN;
            _CURRENT_VALUE_TOKEN += temp;
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
        }
    }

    //TODO Add comments
    function getCommission() external onlyState(State.TokenDistribution) {
        if (msg.sender == _fundAddress) {
            require(_fundLock, "GET: Not now");

            uint256 temp = _fundValue;
            _fundValue = 0;

            require(
                ERC20(_usd).transfer(_fundAddress, temp),
                "GET: Transfer error"
            );
        }

        address owner = RootOfPools_v2(_root).owner();

        if (msg.sender == _owner) {
            require(_fundLock, "GET: Not now");

            uint256 tmp;
            for (uint256 i = 0; i < _listParticipants.length; i++) {
                address user = _listParticipants[i];
                if (_withoutCommission[user]) {
                    tmp += _usdEmergency[user];
                } else {
                    tmp += (_usdEmergency[user] * _outCommission) / 100;
                }
            }
            uint256 value = _CURRENT_VALUE_TOKEN + _DISTRIBUTED_TOKEN;
            tmp = value - ((tmp * value) / _FUNDS_RAISED);

            _DISTRIBUTED_TOKEN += tmp;
            _CURRENT_VALUE_TOKEN -= tmp;

            if (tmp != 0) {
                require(
                    ERC20(_token).transfer(owner, tmp),
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
    function myAllocationEmergency(address user)
        external
        view
        returns (uint256)
    {
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
