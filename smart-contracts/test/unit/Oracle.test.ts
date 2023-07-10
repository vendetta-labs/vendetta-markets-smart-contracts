import { expect } from "chai";
import { ethers } from "hardhat";
import { Oracle } from "../../typechain-types";

export async function deployOracle(team1: string = "FNC", team2: string = "G2"): Promise<Oracle> {
  const Oracle = await ethers.getContractFactory("Oracle");
  const oracle = await Oracle.deploy(team1, team2);
  return oracle;
}

describe("Oracle", function () {
  it("should create the oracle", async function () {
    const oracle = await deployOracle("FNC", "G2");

    const team1 = await oracle.team1();
    const team2 = await oracle.team2();
    const winner = await oracle.getWinner();
    const hasWinner = await oracle.hasWinner();

    expect(team1).to.equal("FNC");
    expect(team2).to.equal("G2");
    expect(hasWinner).to.equal(false);
    expect(winner).to.equal("");
  });

  it("throw an error when creating if team1 is empty", async function () {
    const Oracle = await ethers.getContractFactory("Oracle");

    await expect(Oracle.deploy("", "G2")).to.be.revertedWith("Team 1 can't be empty");
  });

  it("throw an error when creating if team2 is empty", async function () {
    const Oracle = await ethers.getContractFactory("Oracle");

    await expect(Oracle.deploy("FNC", "")).to.be.revertedWith("Team 2 can't be empty");
  });

  it("throw an error when creating if team1 is the same as team2", async function () {
    const Oracle = await ethers.getContractFactory("Oracle");

    await expect(Oracle.deploy("FNC", "FNC")).to.be.revertedWith("Team 1 and Team 2 can't be the same");
  });

  it("should be able to return winner for anyone", async function () {
    const oracle = await deployOracle("FNC", "G2");

    const notAdmin = await ethers.provider.getSigner(1);

    let winner = await oracle.connect(notAdmin).getWinner();
    let hasWinner = await oracle.connect(notAdmin).hasWinner();

    expect(hasWinner).to.equal(false);
    expect(winner).to.equal("");

    await oracle.setWinner("G2");

    winner = await oracle.connect(notAdmin).getWinner();
    hasWinner = await oracle.connect(notAdmin).hasWinner();

    expect(hasWinner).to.equal(true);
    expect(winner).to.equal("G2");
  });

  it("should set the winner", async function () {
    const oracle = await deployOracle("FNC", "G2");

    await oracle.setWinner("FNC");
    const winner = await oracle.getWinner();
    const hasWinner = await oracle.hasWinner();

    expect(hasWinner).to.equal(true);
    expect(winner).to.equal("FNC");
  });

  it("throw an error when setting the winner if not admin", async function () {
    const oracle = await deployOracle("FNC", "G2");

    const notAdmin = await ethers.provider.getSigner(1);

    await expect(oracle.connect(notAdmin).setWinner("FNC")).to.be.revertedWith("Only the admin can call this function");
  });

  it("throw an error when setting the winner if already set", async function () {
    const oracle = await deployOracle("FNC", "G2");

    await oracle.setWinner("FNC");

    await expect(oracle.setWinner("G2")).to.be.revertedWith("Winner can only be set once");
  });

  it("throw an error when setting the winner if not a team", async function () {
    const oracle = await deployOracle("FNC", "G2");

    await expect(oracle.setWinner("TSM")).to.be.revertedWith("Winner needs to be either FNC or G2");
  });

  it("throw an error when setting the winner if empty", async function () {
    const oracle = await deployOracle("FNC", "G2");

    await expect(oracle.setWinner("")).to.be.revertedWith("Winner needs to be either FNC or G2");
  });
});
