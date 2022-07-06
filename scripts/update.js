const { ethers, upgrades } = require("hardhat");

const PROXY = "0xA6BE3e7e399ECca5bDa856fEaC18dB40848B83D3";

async function main() {
  const ROP = await ethers.getContractFactory("RootOfPools_v013");
  const owner = await ethers.getSigner();

  const rop = await upgrades.upgradeProxy(PROXY, ROP);

  console.log("ROP upgraded");
}

main();
