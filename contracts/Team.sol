//SPDX-License-Identifier: GNU GPLv3
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../contracts/ROP.sol";

contract Team is Ownable {
    struct Member {
        address[] addresses;
        uint256 usefulness; //Part in %
        bool isLock;
    }

    struct Project {
        mapping(address => uint256) withdrawn;
        uint256 currentTotalValue;
        uint256 currentBalance;
    }

    mapping(string => Member) members;
    mapping(address => Project) projects;
    string[] listMembers;

    //Member part
    function addMember(
        string calldata _name,
        address _memb,
        uint256 _usefulness,
        bool _isLock
    ) public onlyOwner {
        require(!members[_name].isLock);
        members[_name].addresses.push(_memb);
        members[_name].usefulness = _usefulness;
        members[_name].isLock = _isLock;

        listMembers.push(_name);
    }

    function changeMember(
        string calldata _name,
        address _memb,
        uint256 _usefulness,
        bool _isLock
    ) public onlyOwner {
        require(members[_name].addresses.length != 0);
        require(!members[_name].isLock);

        members[_name].addresses.push(_memb);
        members[_name].usefulness = _usefulness;
        members[_name].isLock = _isLock;
    }

    function delMember(string memory _name) public onlyOwner {
        require(members[_name].addresses.length != 0);
        require(!members[_name].isLock);

        for (uint256 i = 0; i < members[_name].addresses.length; i++) {
            members[_name].addresses.pop();
        }
        members[_name].usefulness = 0;

        for (uint256 i = 0; i < listMembers.length; i++) {
            if (
                keccak256(abi.encodePacked(listMembers[i])) ==
                keccak256(abi.encodePacked(_name))
            ) {
                listMembers[i] = listMembers[listMembers.length - 1];
                listMembers.pop();
            }
        }
    }

    function addAddress(string calldata _name, address _addr) public {
        for (uint256 j = 0; j < members[_name].addresses.length; j++) {
            if (msg.sender == members[_name].addresses[j]) {
                members[_name].addresses.push(_addr);
            }
        }
    }

    //Team part end

    function claim(string calldata _name, address _token) public {
        for (uint256 j = 0; j < members[_name].addresses.length; j++) {
            if (msg.sender == members[_name].addresses[j]) {
                //claim
                uint256 balance = ERC20(_token).balanceOf(address(this));
                if (balance > 0) {
                    if (balance > projects[_token].currentBalance) {
                        projects[_token].currentTotalValue +=
                            balance -
                            projects[_token].currentBalance;
                        projects[_token].currentBalance = balance;
                    }

                    uint256 toSend = (projects[_token].currentTotalValue *
                        members[_name].usefulness) / 100;

                    //- текyщие выводы
                    for (
                        uint256 i = 0;
                        i < members[_name].addresses.length;
                        i++
                    ) {
                        toSend -= projects[_token].withdrawn[
                            members[_name].addresses[i]
                        ];
                    }

                    if (toSend != 0) {
                        require(
                            ERC20(_token).transfer(msg.sender, toSend),
                            "Unknown sending error"
                        );
                    }
                }
            }
        }
    }
}
