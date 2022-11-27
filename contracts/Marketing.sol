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
        uint256 currentTotalValue;
        uint256 totalValue;
        address token;
        //======================//
        bool isClosed;
        uint256 closingTimeStamp;
    }

    address root;
    address globalAdmin;

    mapping(string => Project) Projects;
    string[] public listProjects;

    constructor(address _root, address _globalAdmin) {
        root = _root;
        globalAdmin = _globalAdmin;
    }

    function findUser(
        string calldata _name,
        address _user
    ) internal view returns (uint256) {
        Project storage project = Projects[_name];

        for (uint256 i = 0; i < project.users.length; i++) {
            if (project.users[i].userAdr == _user) {
                return i;
            }
        }
    }

    function getUserAmount(
        string calldata _name,
        address _user
    ) public view returns (uint256) {
        return Projects[_name].users[findUser(_name, _user)].amount;
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
        Projects[_name].isClosed = true;
    }

    function claim(string calldata _name) public {
        Project storage project = Projects[_name];
        require(project.users.length != 0, "Unknown project");
        uint256 userId = findUser(_name, msg.sender);

        uint256 amount = project.users[userId].amount;
        require(amount != 0, "You are not a participant");

        uint256 totalValue = project.totalValue;
        uint256 currentValue = ERC20(project.token).balanceOf(address(this));

        if (currentValue > project.currentTotalValue) {
            Projects[_name].currentTotalValue +=
                currentValue -
                project.currentTotalValue;
        }

        uint256 toSend = ((Projects[_name].currentTotalValue * amount) /
            totalValue) - project.withdrawn[project.users[userId].userAdr];

        project.withdrawn[project.users[userId].userAdr] += toSend;

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
