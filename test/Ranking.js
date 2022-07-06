const {
  BN, // Big Number support
  constants, // Common constants, like the zero address and largest integers
  expectEvent, // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require("@openzeppelin/test-helpers");
const { inputToConfig } = require("@ethereum-waffle/compiler");
const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { inTransaction } = require("@openzeppelin/test-helpers/src/expectEvent");

describe("Ranking", async function () {
  beforeEach(async function () {
    RANKS = await ethers.getContractFactory("Ranking");
    [owner, addr1, addr2, addr3, ...addrs] = await ethers.getSigners();

    ranks = await RANKS.deploy();

    ranks
      .connect(owner)
      .createRank("Common", ["min", "max", "commission"], [100, 500, 20], true);
  });

  it("", async function () {});
});
