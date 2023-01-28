//SPDX-License-Identifier: GNU GPLv3
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../contracts/ROP.sol";

contract Marketing is Ownable {
    struct User {
        address userAdr;
        uint256 amount;
    }

    struct Project {
        User[] users;
        mapping(address => uint256) withdrawn;
        uint256 totalWithdrawn;
        uint256 currentTotalValue;
        uint256 totalValue;
        address token;
        //======================//
        bool isClosed;
        uint256 closingTimeStamp;
    }

    address globalAdmin;

    mapping(string => Project) Projects;
    string[] public listProjects;

    constructor(address _globalAdmin) {
        globalAdmin = _globalAdmin;
    }

    function findUser(
        string calldata _name,
        address _user
    ) internal view returns (User memory) {
        Project storage project = Projects[_name];
        User memory user;

        for (uint256 i = 0; i < project.users.length; i++) {
            if (project.users[i].userAdr == _user) {
                user = project.users[i];
                return user;
            }
        }

        return user;
    }

    function getProject(
        string calldata _name
    )
        public
        view
        returns (
            uint256 totalWithdrawn,
            uint256 currentTotalValue,
            uint256 totalValue,
            address token,
            bool isClosed,
            uint256 closingTimeStamp
        )
    {
        return (
            Projects[_name].totalWithdrawn,
            Projects[_name].currentTotalValue,
            Projects[_name].totalValue,
            Projects[_name].token,
            Projects[_name].isClosed,
            Projects[_name].closingTimeStamp
        );
    }

    function getUserAmount(
        string calldata _name,
        address _user
    ) public view returns (uint256) {
        return findUser(_name, _user).amount;
    }

    function getTotalValue(
        string calldata _name
    ) public view returns (uint256) {
        return Projects[_name].totalValue;
    }

    function getToken(string calldata _name) public view returns (address) {
        return Projects[_name].token;
    }

    function addProject(
        string calldata _name,
        uint256 _totalValue,
        uint256 _closingTimeStamp,
        address _token
    ) public onlyOwner {
        require(Projects[_name].users.length == 0, "Such a project exists");

        Projects[_name].totalValue = _totalValue;
        Projects[_name].closingTimeStamp = _closingTimeStamp;
        Projects[_name].isClosed = false;
        Projects[_name].token = _token;

        listProjects.push(_name);
    }

    function setProjectAmounts(
        string calldata _name,
        address[] calldata _users,
        uint256[] calldata _amounts
    ) public onlyOwner {
        require(!Projects[_name].isClosed, "This project may not be modified");
        require(_users.length == _amounts.length, "Array length violation");

        for (uint256 i = 0; i < _users.length; i++) {
            User memory user;
            user.userAdr = _users[i];
            user.amount = _amounts[i];

            Projects[_name].users.push(user);
        }
    }

    function closeProject(string calldata _name) public onlyOwner {
        Project storage project = Projects[_name];
        uint256 total = 0;
        for (uint256 i = 0; i < project.users.length; i++) {
            total += project.users[i].amount;
        }

        require(
            project.totalValue == total,
            "The import data do not match the specified"
        );

        Projects[_name].isClosed = true;
    }

    function claim(string calldata _name) public {
        Project storage project = Projects[_name];
        require(project.users.length != 0, "Unknown project");
        User memory user = findUser(_name, msg.sender);
        if (user.userAdr == address(0)) {
            return;
        }

        uint256 amount = user.amount;
        require(amount != 0, "You are not a participant");

        uint256 totalValue = project.totalValue;
        uint256 currentValue = ERC20(project.token).balanceOf(address(this));

        if (currentValue + project.totalWithdrawn > project.currentTotalValue) {
            Projects[_name].currentTotalValue +=
                (currentValue + project.totalWithdrawn) -
                project.currentTotalValue;
        }

        uint256 toSend = ((Projects[_name].currentTotalValue * amount) /
            totalValue) - project.withdrawn[user.userAdr];

        Projects[_name].withdrawn[user.userAdr] += toSend;
        Projects[_name].totalWithdrawn += toSend;

        require(
            ERC20(project.token).transfer(msg.sender, toSend),
            "Unknown sending error"
        );
    }

    function withdrawFunds() public onlyOwner {
        for (uint256 i = 0; i < listProjects.length; i++) {
            if (Projects[listProjects[i]].closingTimeStamp < block.timestamp) {
                uint256 balance = ERC20(Projects[listProjects[i]].token)
                    .balanceOf(address(this));

                ERC20(Projects[listProjects[i]].token).transfer(
                    globalAdmin,
                    balance
                );
            }
        }
    }
}
