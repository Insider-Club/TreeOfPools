const { ethers, upgrades } = require("hardhat");
const readline = require("readline-sync");

async function main() {
  const PROXY = readline.question("Enter the proxy address: ");

  const ROP = await ethers.getContractFactory("RootOfPools_v013");
  const owner = await ethers.getSigner();

  const rop = await upgrades.upgradeProxy(PROXY, ROP);

  console.log("ROP successfully upgraded!");
}

main();
