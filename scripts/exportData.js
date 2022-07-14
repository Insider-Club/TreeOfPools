const { ethers } = require("hardhat");
const readline = require("readline-sync");
const fs = require("fs");
const BOPArtifacts = require("../artifacts/contracts/BOP.sol/BranchOfPools.json");

async function main(){
    const POOL = readline.question("Enter the pool address: ");

    const pool = new ethers.Contract(POOL, BOPArtifacts.abi, ethers.provider);

    const FR = await pool._FUNDS_RAISED();
    const CC = await pool._CURRENT_COMMISSION();
    
    users =await pool.getUsers(); //Get users list
    console.log(users);

    values = [];
    for(i = 0; i < users.length; i++){
        values[i] = await pool.myAllocation(users[i]);
    }
    console.log(values);

    forWrite = JSON.stringify({FR, CC, users, values});

    fs.writeFile("usersData.json", forWrite, function(err) {
        if (err) {
           return console.error(err);
        }
        console.log("Data written successfully!");
    });
}

main();