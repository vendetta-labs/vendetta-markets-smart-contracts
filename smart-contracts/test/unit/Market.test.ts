import { expect } from "chai";
import { ethers } from "hardhat";
import { ZeroAddress } from "ethers";
import { Market, FakeToken } from "../../typechain-types";
import { deployOracle } from "./Oracle.test";

export async function deployFakeToken(totalSupply: string = "1000000"): Promise<FakeToken> {
  const FakeToken = await ethers.getContractFactory("FakeToken");
  const token = await FakeToken.deploy(ethers.parseEther(totalSupply));
  return token;
}

export async function deployMarket(options?: {
  team1?: string;
  team2?: string;
  tokenAddress?: string;
  oracleAddress?: string;
}): Promise<Market> {
  const tokenAddress = options?.tokenAddress || (await deployFakeToken()).getAddress();
  const Market = await ethers.getContractFactory("Market");
  const oracleAddress = options?.oracleAddress || (await deployOracle(options?.team1, options?.team2)).getAddress();
  const market = await Market.deploy(tokenAddress, oracleAddress);
  return market;
}

describe("Market", function () {
  it("should create the market", async function () {
    const market = await deployMarket({ team1: "FNC", team2: "G2" });

    const winner = await market.winner();
    const oracleAddress = await market.oracle();
    const oracle = await ethers.getContractAt("Oracle", oracleAddress);
    const team1 = await oracle.team1();
    const team2 = await oracle.team2();
    expect(team1).to.equal("FNC");
    expect(team2).to.equal("G2");
    expect(winner).to.equal("");
  });

  it("throw an error when creating if the token address is zero address", async function () {
    const Market = await ethers.getContractFactory("Market");
    const oracleAddress = await (await deployOracle("FNC", "G2")).getAddress();

    await expect(Market.deploy(ZeroAddress, oracleAddress)).to.be.revertedWith("ERC20: cant be zero address");
  });

  it("throw an error when creating if the oracle address is zero address", async function () {
    const Market = await ethers.getContractFactory("Market");
    const tokenAddress = await (await deployFakeToken()).getAddress();

    await expect(Market.deploy(tokenAddress, ZeroAddress)).to.be.revertedWith("Oracle: cant be zero address");
  });

  it("returns the winner after the oracle has been set", async function () {
    const oracle = await deployOracle("FNC", "G2");
    const market = await deployMarket({ oracleAddress: await oracle.getAddress() });

    let winner = await market.winner();
    expect(winner).to.equal("");

    await oracle.setWinner("G2");

    winner = await market.winner();
    expect(winner).to.equal("G2");
  });

  it("accepts bets and distributes rewards after score is settled", async function () {
    const token = await deployFakeToken("1000");
    const team1 = "FNC";
    const team2 = "G2";
    const oracle = await deployOracle(team1, team2);
    const market = await deployMarket({
      tokenAddress: await token.getAddress(),
      oracleAddress: await oracle.getAddress(),
    });

    const player1 = await ethers.provider.getSigner(0);
    const player2 = await ethers.provider.getSigner(1);
    const player3 = await ethers.provider.getSigner(2);

    expect(await token.balanceOf(await player1.getAddress())).to.equal(ethers.parseEther("1000"));
    (await token.connect(player1).transfer(await player2.getAddress(), ethers.parseEther("100"))).wait();
    (await token.connect(player1).transfer(await player3.getAddress(), ethers.parseEther("100"))).wait();
    expect(await token.balanceOf(await player1.getAddress())).to.equal(ethers.parseEther("800"));
    expect(await token.balanceOf(await player2.getAddress())).to.equal(ethers.parseEther("100"));
    expect(await token.balanceOf(await player3.getAddress())).to.equal(ethers.parseEther("100"));

    (await token.connect(player1).increaseAllowance(await market.getAddress(), ethers.parseEther("10"))).wait();
    (await token.connect(player2).increaseAllowance(await market.getAddress(), ethers.parseEther("10"))).wait();
    (await token.connect(player3).increaseAllowance(await market.getAddress(), ethers.parseEther("10"))).wait();

    (await market.connect(player1).bet(ethers.parseEther("2"), team1)).wait();

    (await market.connect(player2).bet(ethers.parseEther("10"), team2)).wait();

    (await market.connect(player1).bet(ethers.parseEther("3"), team2)).wait();

    (await market.connect(player3).bet(ethers.parseEther("3"), team1)).wait();

    (await market.connect(player1).bet(ethers.parseEther("3"), team1)).wait();

    expect(await token.balanceOf(await market.getAddress())).to.equal(ethers.parseEther("21"));
    expect(await token.balanceOf(await player1.getAddress())).to.equal(ethers.parseEther("792"));
    expect(await token.balanceOf(await player2.getAddress())).to.equal(ethers.parseEther("90"));
    expect(await token.balanceOf(await player3.getAddress())).to.equal(ethers.parseEther("97"));

    const betsPlayer1 = await market.getBets(await player1.getAddress());
    expect(betsPlayer1.length).to.equal(3);

    const betsPlayer2 = await market.getBets(await player2.getAddress());
    expect(betsPlayer2.length).to.equal(1);

    const betsPlayer3 = await market.getBets(await player3.getAddress());
    expect(betsPlayer3.length).to.equal(1);

    await oracle.connect(player1).setWinner(team1);

    const player1Rewards = await market.getRewards(await player1.getAddress());
    expect(player1Rewards).to.equal(ethers.parseEther("13.125"));

    const player2Rewards = await market.getRewards(await player2.getAddress());
    expect(player2Rewards).to.equal(ethers.parseEther("0"));

    const player3Rewards = await market.getRewards(await player3.getAddress());
    expect(player3Rewards).to.equal(ethers.parseEther("7.875"));

    await (await market.connect(player1).claimRewards()).wait();
    expect(await token.balanceOf(await player1.getAddress())).to.equal(ethers.parseEther("805.125"));

    expect(market.connect(player2).claimRewards()).to.be.revertedWith("No rewards to claim");

    await (await market.connect(player3).claimRewards()).wait();
    expect(await token.balanceOf(await player3.getAddress())).to.equal(ethers.parseEther("104.875"));

    expect(await token.balanceOf(await market.getAddress())).to.equal(ethers.parseEther("0"));
  });

  it("throw an error when trying to bet and the market is already settled", async function () {
    const token = await deployFakeToken("1000");
    const oracle = await deployOracle("FNC", "G2");
    const market = await deployMarket({
      oracleAddress: await oracle.getAddress(),
    });

    const player = await ethers.provider.getSigner(1);
    await (await token.transfer(await player.getAddress(), ethers.parseEther("100"))).wait();
    expect(await token.balanceOf(await player.getAddress())).to.equal(ethers.parseEther("100"));

    await oracle.setWinner("FNC");
    expect(await market.winner()).to.equal("FNC");

    await (await token.connect(player).increaseAllowance(await market.getAddress(), ethers.parseEther("50"))).wait();
    await expect(market.connect(player).bet(ethers.parseEther("50"), "FNC")).to.be.revertedWith("Market is settled");
  });

  it("throw an error when trying to bet on an empty team", async function () {
    const token = await deployFakeToken("1000");
    const oracle = await deployOracle("FNC", "G2");
    const market = await deployMarket({
      oracleAddress: await oracle.getAddress(),
    });

    const player = await ethers.provider.getSigner(1);
    await (await token.transfer(await player.getAddress(), ethers.parseEther("100"))).wait();
    expect(await token.balanceOf(await player.getAddress())).to.equal(ethers.parseEther("100"));

    await (await token.connect(player).increaseAllowance(await market.getAddress(), ethers.parseEther("50"))).wait();
    await expect(market.connect(player).bet(ethers.parseEther("50"), "")).to.be.revertedWith("Team can't be empty");
  });

  it("throw an error when trying to bet on a team and it is not in the oracle", async function () {
    const token = await deployFakeToken("1000");
    const team1 = "FNC";
    const team2 = "G2";
    const market = await deployMarket({ team1, team2 });

    const player = await ethers.provider.getSigner(1);
    await (await token.transfer(await player.getAddress(), ethers.parseEther("100"))).wait();
    expect(await token.balanceOf(await player.getAddress())).to.equal(ethers.parseEther("100"));

    await (await token.connect(player).increaseAllowance(await market.getAddress(), ethers.parseEther("50"))).wait();
    await expect(market.connect(player).bet(ethers.parseEther("50"), "TSM")).to.be.revertedWith(
      `Team needs to be either ${team1} or ${team2}`
    );
  });

  it("throw an error when trying to bet with a 0 amount", async function () {
    const token = await deployFakeToken("1000");
    const oracle = await deployOracle("FNC", "G2");
    const market = await deployMarket({
      oracleAddress: await oracle.getAddress(),
    });

    const player = await ethers.provider.getSigner(1);
    await (await token.transfer(await player.getAddress(), ethers.parseEther("100"))).wait();
    expect(await token.balanceOf(await player.getAddress())).to.equal(ethers.parseEther("100"));

    await (await token.connect(player).increaseAllowance(await market.getAddress(), ethers.parseEther("50"))).wait();
    await expect(market.connect(player).bet(ethers.parseEther("0"), "FNC")).to.be.revertedWith(
      "The bet must bet more than 0"
    );
  });

  it("distribuite the winnings in a proportional way", async function () {
    const token = await deployFakeToken("1000");
    const team1 = "FNC";
    const team2 = "G2";
    const oracle = await deployOracle(team1, team2);
    const market = await deployMarket({
      tokenAddress: await token.getAddress(),
      oracleAddress: await oracle.getAddress(),
    });

    const player1 = await ethers.provider.getSigner(0);
    const player2 = await ethers.provider.getSigner(1);
    const player3 = await ethers.provider.getSigner(2);

    (await token.connect(player1).transfer(await player2.getAddress(), ethers.parseEther("100"))).wait();
    (await token.connect(player1).transfer(await player3.getAddress(), ethers.parseEther("100"))).wait();

    (await token.connect(player1).increaseAllowance(await market.getAddress(), ethers.parseEther("10"))).wait();
    (await token.connect(player2).increaseAllowance(await market.getAddress(), ethers.parseEther("10"))).wait();
    (await token.connect(player3).increaseAllowance(await market.getAddress(), ethers.parseEther("10"))).wait();

    (await market.connect(player1).bet(ethers.parseEther("2"), team1)).wait();
    (await market.connect(player2).bet(ethers.parseEther("10"), team2)).wait();
    (await market.connect(player1).bet(ethers.parseEther("3"), team2)).wait();
    (await market.connect(player3).bet(ethers.parseEther("3"), team1)).wait();
    (await market.connect(player1).bet(ethers.parseEther("3"), team1)).wait();

    await oracle.connect(player1).setWinner(team1);

    await (await market.connect(player1).claimRewards()).wait();
    expect(await token.balanceOf(await player1.getAddress())).to.equal(ethers.parseEther("805.125"));
  });

  it("throw an error when trying to get rewards and the market isn't settled", async function () {
    const token = await deployFakeToken("1000");
    const team1 = "FNC";
    const team2 = "G2";
    const oracle = await deployOracle(team1, team2);
    const market = await deployMarket({
      tokenAddress: await token.getAddress(),
      oracleAddress: await oracle.getAddress(),
    });

    const player1 = await ethers.provider.getSigner(0);
    const player2 = await ethers.provider.getSigner(1);
    const player3 = await ethers.provider.getSigner(2);

    (await token.connect(player1).transfer(await player2.getAddress(), ethers.parseEther("100"))).wait();
    (await token.connect(player1).transfer(await player3.getAddress(), ethers.parseEther("100"))).wait();

    (await token.connect(player1).increaseAllowance(await market.getAddress(), ethers.parseEther("10"))).wait();
    (await token.connect(player2).increaseAllowance(await market.getAddress(), ethers.parseEther("10"))).wait();
    (await token.connect(player3).increaseAllowance(await market.getAddress(), ethers.parseEther("10"))).wait();

    (await market.connect(player1).bet(ethers.parseEther("2"), team1)).wait();
    (await market.connect(player2).bet(ethers.parseEther("10"), team2)).wait();
    (await market.connect(player1).bet(ethers.parseEther("3"), team2)).wait();
    (await market.connect(player3).bet(ethers.parseEther("3"), team1)).wait();
    (await market.connect(player1).bet(ethers.parseEther("3"), team1)).wait();

    await expect(market.connect(player1).claimRewards()).to.be.revertedWith("Market is not settled yet");

    expect(await token.balanceOf(await player1.getAddress())).to.equal(ethers.parseEther("792"));
  });

  it("throw an error when trying to get rewards if already claimed", async function () {
    const token = await deployFakeToken("1000");
    const team1 = "FNC";
    const team2 = "G2";
    const oracle = await deployOracle(team1, team2);
    const market = await deployMarket({
      tokenAddress: await token.getAddress(),
      oracleAddress: await oracle.getAddress(),
    });

    const player1 = await ethers.provider.getSigner(0);
    const player2 = await ethers.provider.getSigner(1);
    const player3 = await ethers.provider.getSigner(2);

    (await token.connect(player1).transfer(await player2.getAddress(), ethers.parseEther("100"))).wait();
    (await token.connect(player1).transfer(await player3.getAddress(), ethers.parseEther("100"))).wait();

    (await token.connect(player1).increaseAllowance(await market.getAddress(), ethers.parseEther("10"))).wait();
    (await token.connect(player2).increaseAllowance(await market.getAddress(), ethers.parseEther("10"))).wait();
    (await token.connect(player3).increaseAllowance(await market.getAddress(), ethers.parseEther("10"))).wait();

    (await market.connect(player1).bet(ethers.parseEther("2"), team1)).wait();
    (await market.connect(player2).bet(ethers.parseEther("10"), team2)).wait();
    (await market.connect(player1).bet(ethers.parseEther("3"), team2)).wait();
    (await market.connect(player3).bet(ethers.parseEther("3"), team1)).wait();
    (await market.connect(player1).bet(ethers.parseEther("3"), team1)).wait();

    await oracle.connect(player1).setWinner(team1);

    await (await market.connect(player1).claimRewards()).wait();
    expect(await token.balanceOf(await player1.getAddress())).to.equal(ethers.parseEther("805.125"));

    await expect(market.connect(player1).claimRewards()).to.be.revertedWith("Rewards already claimed");

    expect(await token.balanceOf(await player1.getAddress())).to.equal(ethers.parseEther("805.125"));
  });

  it("throw an error when trying to get rewards and there are none", async function () {
    const token = await deployFakeToken("1000");
    const team1 = "FNC";
    const team2 = "G2";
    const oracle = await deployOracle(team1, team2);
    const market = await deployMarket({
      tokenAddress: await token.getAddress(),
      oracleAddress: await oracle.getAddress(),
    });

    const player1 = await ethers.provider.getSigner(0);
    const player2 = await ethers.provider.getSigner(1);
    const player3 = await ethers.provider.getSigner(2);
    const player4 = await ethers.provider.getSigner(3);

    (await token.connect(player1).transfer(await player2.getAddress(), ethers.parseEther("100"))).wait();
    (await token.connect(player1).transfer(await player3.getAddress(), ethers.parseEther("100"))).wait();

    (await token.connect(player1).increaseAllowance(await market.getAddress(), ethers.parseEther("10"))).wait();
    (await token.connect(player2).increaseAllowance(await market.getAddress(), ethers.parseEther("10"))).wait();
    (await token.connect(player3).increaseAllowance(await market.getAddress(), ethers.parseEther("10"))).wait();

    (await market.connect(player1).bet(ethers.parseEther("2"), team1)).wait();
    (await market.connect(player2).bet(ethers.parseEther("10"), team2)).wait();
    (await market.connect(player1).bet(ethers.parseEther("3"), team2)).wait();
    (await market.connect(player3).bet(ethers.parseEther("3"), team1)).wait();
    (await market.connect(player1).bet(ethers.parseEther("3"), team1)).wait();

    await oracle.connect(player1).setWinner(team1);

    await expect(market.connect(player4).claimRewards()).to.be.revertedWith("No rewards to claim");

    expect(await token.balanceOf(await player4.getAddress())).to.equal(ethers.parseEther("0"));
  });

  it("returns wether a player has claimed their rewards or not", async function () {
    const token = await deployFakeToken("1000");
    const team1 = "FNC";
    const team2 = "G2";
    const oracle = await deployOracle(team1, team2);
    const market = await deployMarket({
      tokenAddress: await token.getAddress(),
      oracleAddress: await oracle.getAddress(),
    });

    const player1 = await ethers.provider.getSigner(0);
    const player2 = await ethers.provider.getSigner(1);
    const player3 = await ethers.provider.getSigner(2);

    (await token.connect(player1).transfer(await player2.getAddress(), ethers.parseEther("100"))).wait();
    (await token.connect(player1).transfer(await player3.getAddress(), ethers.parseEther("100"))).wait();

    (await token.connect(player1).increaseAllowance(await market.getAddress(), ethers.parseEther("10"))).wait();
    (await token.connect(player2).increaseAllowance(await market.getAddress(), ethers.parseEther("10"))).wait();
    (await token.connect(player3).increaseAllowance(await market.getAddress(), ethers.parseEther("10"))).wait();

    (await market.connect(player1).bet(ethers.parseEther("2"), team1)).wait();
    (await market.connect(player2).bet(ethers.parseEther("10"), team2)).wait();
    (await market.connect(player1).bet(ethers.parseEther("3"), team2)).wait();
    (await market.connect(player3).bet(ethers.parseEther("3"), team1)).wait();
    (await market.connect(player1).bet(ethers.parseEther("3"), team1)).wait();

    await oracle.connect(player1).setWinner(team1);

    expect(await market.connect(player3).hasClaimedRewards(player3.address)).to.equal(false);

    await (await market.connect(player3).claimRewards()).wait();

    expect(await market.connect(player3).hasClaimedRewards(player3.address)).to.equal(true);
  });

  it("returns some player's bets", async function () {
    const token = await deployFakeToken("1000");
    const team1 = "FNC";
    const team2 = "G2";
    const oracle = await deployOracle(team1, team2);
    const market = await deployMarket({
      tokenAddress: await token.getAddress(),
      oracleAddress: await oracle.getAddress(),
    });

    const player1 = await ethers.provider.getSigner(0);
    const player2 = await ethers.provider.getSigner(1);
    const player3 = await ethers.provider.getSigner(2);

    (await token.connect(player1).transfer(await player2.getAddress(), ethers.parseEther("100"))).wait();
    (await token.connect(player1).transfer(await player3.getAddress(), ethers.parseEther("100"))).wait();

    (await token.connect(player1).increaseAllowance(await market.getAddress(), ethers.parseEther("10"))).wait();
    (await token.connect(player2).increaseAllowance(await market.getAddress(), ethers.parseEther("10"))).wait();
    (await token.connect(player3).increaseAllowance(await market.getAddress(), ethers.parseEther("10"))).wait();

    (await market.connect(player1).bet(ethers.parseEther("2"), team1)).wait();
    (await market.connect(player2).bet(ethers.parseEther("10"), team2)).wait();
    (await market.connect(player1).bet(ethers.parseEther("3"), team2)).wait();
    (await market.connect(player3).bet(ethers.parseEther("3"), team1)).wait();
    (await market.connect(player1).bet(ethers.parseEther("3"), team1)).wait();

    await oracle.connect(player1).setWinner(team1);

    const player1Bets = await market.connect(player1).getBets(player1.address);

    expect(player1Bets[0][1]).to.equal(ethers.parseEther("2"));
    expect(player1Bets[0][2]).to.equal(team1);

    expect(player1Bets[1][1]).to.equal(ethers.parseEther("3"));
    expect(player1Bets[1][2]).to.equal(team2);

    expect(player1Bets[2][1]).to.equal(ethers.parseEther("3"));
    expect(player1Bets[2][2]).to.equal(team1);

    const player2Bets = await market.connect(player2).getBets(player2.address);

    expect(player2Bets[0][1]).to.equal(ethers.parseEther("10"));
    expect(player2Bets[0][2]).to.equal(team2);

    const player3Bets = await market.connect(player3).getBets(player3.address);

    expect(player3Bets[0][1]).to.equal(ethers.parseEther("3"));
    expect(player3Bets[0][2]).to.equal(team1);
  });

  it("returns my bets", async function () {
    const token = await deployFakeToken("1000");
    const team1 = "FNC";
    const team2 = "G2";
    const oracle = await deployOracle(team1, team2);
    const market = await deployMarket({
      tokenAddress: await token.getAddress(),
      oracleAddress: await oracle.getAddress(),
    });

    const player1 = await ethers.provider.getSigner(0);
    const player2 = await ethers.provider.getSigner(1);
    const player3 = await ethers.provider.getSigner(2);

    (await token.connect(player1).transfer(await player2.getAddress(), ethers.parseEther("100"))).wait();
    (await token.connect(player1).transfer(await player3.getAddress(), ethers.parseEther("100"))).wait();

    (await token.connect(player1).increaseAllowance(await market.getAddress(), ethers.parseEther("10"))).wait();
    (await token.connect(player2).increaseAllowance(await market.getAddress(), ethers.parseEther("10"))).wait();
    (await token.connect(player3).increaseAllowance(await market.getAddress(), ethers.parseEther("10"))).wait();

    (await market.connect(player1).bet(ethers.parseEther("2"), team1)).wait();
    (await market.connect(player2).bet(ethers.parseEther("10"), team2)).wait();
    (await market.connect(player1).bet(ethers.parseEther("3"), team2)).wait();
    (await market.connect(player3).bet(ethers.parseEther("3"), team1)).wait();
    (await market.connect(player1).bet(ethers.parseEther("3"), team1)).wait();

    await oracle.connect(player1).setWinner(team1);

    const bets = await market.connect(player2).getMyBets();

    expect(bets[0][1]).to.equal(ethers.parseEther("10"));
    expect(bets[0][2]).to.equal(team2);
  });

  it("get rewards of some player", async function () {
    const token = await deployFakeToken("1000");
    const team1 = "FNC";
    const team2 = "G2";
    const oracle = await deployOracle(team1, team2);
    const market = await deployMarket({
      tokenAddress: await token.getAddress(),
      oracleAddress: await oracle.getAddress(),
    });

    const player1 = await ethers.provider.getSigner(0);
    const player2 = await ethers.provider.getSigner(1);
    const player3 = await ethers.provider.getSigner(2);

    (await token.connect(player1).transfer(await player2.getAddress(), ethers.parseEther("100"))).wait();
    (await token.connect(player1).transfer(await player3.getAddress(), ethers.parseEther("100"))).wait();

    (await token.connect(player1).increaseAllowance(await market.getAddress(), ethers.parseEther("10"))).wait();
    (await token.connect(player2).increaseAllowance(await market.getAddress(), ethers.parseEther("10"))).wait();
    (await token.connect(player3).increaseAllowance(await market.getAddress(), ethers.parseEther("10"))).wait();

    (await market.connect(player1).bet(ethers.parseEther("2"), team1)).wait();
    (await market.connect(player2).bet(ethers.parseEther("10"), team2)).wait();
    (await market.connect(player1).bet(ethers.parseEther("3"), team2)).wait();
    (await market.connect(player3).bet(ethers.parseEther("3"), team1)).wait();
    (await market.connect(player1).bet(ethers.parseEther("3"), team1)).wait();

    await oracle.connect(player1).setWinner(team1);

    expect(await market.connect(player1).getRewards(player1.address)).to.equal(ethers.parseEther("13.125"));
    expect(await market.connect(player2).getRewards(player2.address)).to.equal(ethers.parseEther("0"));
    expect(await market.connect(player3).getRewards(player3.address)).to.equal(ethers.parseEther("7.875"));
  });

  it("throw an error when getting rewards of some player and market isn't settled", async function () {
    const token = await deployFakeToken("1000");
    const team1 = "FNC";
    const team2 = "G2";
    const oracle = await deployOracle(team1, team2);
    const market = await deployMarket({
      tokenAddress: await token.getAddress(),
      oracleAddress: await oracle.getAddress(),
    });

    const player1 = await ethers.provider.getSigner(0);
    const player2 = await ethers.provider.getSigner(1);
    const player3 = await ethers.provider.getSigner(2);

    (await token.connect(player1).transfer(await player2.getAddress(), ethers.parseEther("100"))).wait();
    (await token.connect(player1).transfer(await player3.getAddress(), ethers.parseEther("100"))).wait();

    (await token.connect(player1).increaseAllowance(await market.getAddress(), ethers.parseEther("10"))).wait();
    (await token.connect(player2).increaseAllowance(await market.getAddress(), ethers.parseEther("10"))).wait();
    (await token.connect(player3).increaseAllowance(await market.getAddress(), ethers.parseEther("10"))).wait();

    (await market.connect(player1).bet(ethers.parseEther("2"), team1)).wait();
    (await market.connect(player2).bet(ethers.parseEther("10"), team2)).wait();
    (await market.connect(player1).bet(ethers.parseEther("3"), team2)).wait();
    (await market.connect(player3).bet(ethers.parseEther("3"), team1)).wait();
    (await market.connect(player1).bet(ethers.parseEther("3"), team1)).wait();

    await expect(market.connect(player3).getRewards(player3.address)).to.be.revertedWith("Market is not settled yet");
  });

  it("get my rewards", async function () {
    const token = await deployFakeToken("1000");
    const team1 = "FNC";
    const team2 = "G2";
    const oracle = await deployOracle(team1, team2);
    const market = await deployMarket({
      tokenAddress: await token.getAddress(),
      oracleAddress: await oracle.getAddress(),
    });

    const player1 = await ethers.provider.getSigner(0);
    const player2 = await ethers.provider.getSigner(1);
    const player3 = await ethers.provider.getSigner(2);

    (await token.connect(player1).transfer(await player2.getAddress(), ethers.parseEther("100"))).wait();
    (await token.connect(player1).transfer(await player3.getAddress(), ethers.parseEther("100"))).wait();

    (await token.connect(player1).increaseAllowance(await market.getAddress(), ethers.parseEther("10"))).wait();
    (await token.connect(player2).increaseAllowance(await market.getAddress(), ethers.parseEther("10"))).wait();
    (await token.connect(player3).increaseAllowance(await market.getAddress(), ethers.parseEther("10"))).wait();

    (await market.connect(player1).bet(ethers.parseEther("2"), team1)).wait();
    (await market.connect(player2).bet(ethers.parseEther("10"), team2)).wait();
    (await market.connect(player1).bet(ethers.parseEther("3"), team2)).wait();
    (await market.connect(player3).bet(ethers.parseEther("3"), team1)).wait();
    (await market.connect(player1).bet(ethers.parseEther("3"), team1)).wait();

    await oracle.connect(player1).setWinner(team1);

    expect(await market.connect(player3).getMyRewards()).to.equal(ethers.parseEther("7.875"));
  });

  it("throw an error when getting my rewards and market isn't settled", async function () {
    const token = await deployFakeToken("1000");
    const team1 = "FNC";
    const team2 = "G2";
    const oracle = await deployOracle(team1, team2);
    const market = await deployMarket({
      tokenAddress: await token.getAddress(),
      oracleAddress: await oracle.getAddress(),
    });

    const player1 = await ethers.provider.getSigner(0);
    const player2 = await ethers.provider.getSigner(1);
    const player3 = await ethers.provider.getSigner(2);

    (await token.connect(player1).transfer(await player2.getAddress(), ethers.parseEther("100"))).wait();
    (await token.connect(player1).transfer(await player3.getAddress(), ethers.parseEther("100"))).wait();

    (await token.connect(player1).increaseAllowance(await market.getAddress(), ethers.parseEther("10"))).wait();
    (await token.connect(player2).increaseAllowance(await market.getAddress(), ethers.parseEther("10"))).wait();
    (await token.connect(player3).increaseAllowance(await market.getAddress(), ethers.parseEther("10"))).wait();

    (await market.connect(player1).bet(ethers.parseEther("2"), team1)).wait();
    (await market.connect(player2).bet(ethers.parseEther("10"), team2)).wait();
    (await market.connect(player1).bet(ethers.parseEther("3"), team2)).wait();
    (await market.connect(player3).bet(ethers.parseEther("3"), team1)).wait();
    (await market.connect(player1).bet(ethers.parseEther("3"), team1)).wait();

    await expect(market.connect(player3).getMyRewards()).to.be.revertedWith("Market is not settled yet");
  });

  it("get potential rewards", async function () {
    const token = await deployFakeToken("1000");
    const team1 = "FNC";
    const team2 = "G2";
    const oracle = await deployOracle(team1, team2);
    const market = await deployMarket({
      tokenAddress: await token.getAddress(),
      oracleAddress: await oracle.getAddress(),
    });

    const player1 = await ethers.provider.getSigner(0);
    const player2 = await ethers.provider.getSigner(1);
    const player3 = await ethers.provider.getSigner(2);

    (await token.connect(player1).transfer(await player2.getAddress(), ethers.parseEther("100"))).wait();
    (await token.connect(player1).transfer(await player3.getAddress(), ethers.parseEther("100"))).wait();

    (await token.connect(player1).increaseAllowance(await market.getAddress(), ethers.parseEther("10"))).wait();
    (await token.connect(player2).increaseAllowance(await market.getAddress(), ethers.parseEther("10"))).wait();
    (await token.connect(player3).increaseAllowance(await market.getAddress(), ethers.parseEther("10"))).wait();

    (await market.connect(player1).bet(ethers.parseEther("2"), team1)).wait();
    (await market.connect(player2).bet(ethers.parseEther("10"), team2)).wait();
    (await market.connect(player1).bet(ethers.parseEther("3"), team2)).wait();
    (await market.connect(player3).bet(ethers.parseEther("3"), team1)).wait();
    (await market.connect(player1).bet(ethers.parseEther("3"), team1)).wait();

    expect(await market.connect(player1).getPotentialRewards(player1.address, team1)).to.equal(
      ethers.parseEther("13.125")
    );
    expect(await market.connect(player1).getPotentialRewards(player1.address, team2)).to.equal(
      ethers.parseEther("4.846152")
    );

    expect(await market.connect(player2).getPotentialRewards(player2.address, team1)).to.equal(ethers.parseEther("0"));
    expect(await market.connect(player2).getPotentialRewards(player2.address, team2)).to.equal(
      ethers.parseEther("16.15384")
    );

    expect(await market.connect(player3).getPotentialRewards(player3.address, team1)).to.equal(
      ethers.parseEther("7.875")
    );
    expect(await market.connect(player3).getPotentialRewards(player3.address, team2)).to.equal(ethers.parseEther("0"));
  });

  it("throw an error when getting potential rewards if winner is empty", async function () {
    const token = await deployFakeToken("1000");
    const team1 = "FNC";
    const team2 = "G2";
    const oracle = await deployOracle(team1, team2);
    const market = await deployMarket({
      tokenAddress: await token.getAddress(),
      oracleAddress: await oracle.getAddress(),
    });

    const player1 = await ethers.provider.getSigner(0);
    const player2 = await ethers.provider.getSigner(1);
    const player3 = await ethers.provider.getSigner(2);

    (await token.connect(player1).transfer(await player2.getAddress(), ethers.parseEther("100"))).wait();
    (await token.connect(player1).transfer(await player3.getAddress(), ethers.parseEther("100"))).wait();

    (await token.connect(player1).increaseAllowance(await market.getAddress(), ethers.parseEther("10"))).wait();
    (await token.connect(player2).increaseAllowance(await market.getAddress(), ethers.parseEther("10"))).wait();
    (await token.connect(player3).increaseAllowance(await market.getAddress(), ethers.parseEther("10"))).wait();

    (await market.connect(player1).bet(ethers.parseEther("2"), team1)).wait();
    (await market.connect(player2).bet(ethers.parseEther("10"), team2)).wait();
    (await market.connect(player1).bet(ethers.parseEther("3"), team2)).wait();
    (await market.connect(player3).bet(ethers.parseEther("3"), team1)).wait();
    (await market.connect(player1).bet(ethers.parseEther("3"), team1)).wait();

    await expect(market.connect(player1).getPotentialRewards(player1.address, "")).to.be.revertedWith(
      "Winner can't be empty"
    );
  });

  it("throw an error when getting potential rewards if winner is neither oracle team", async function () {
    const token = await deployFakeToken("1000");
    const team1 = "FNC";
    const team2 = "G2";
    const oracle = await deployOracle(team1, team2);
    const market = await deployMarket({
      tokenAddress: await token.getAddress(),
      oracleAddress: await oracle.getAddress(),
    });

    const player1 = await ethers.provider.getSigner(0);
    const player2 = await ethers.provider.getSigner(1);
    const player3 = await ethers.provider.getSigner(2);

    (await token.connect(player1).transfer(await player2.getAddress(), ethers.parseEther("100"))).wait();
    (await token.connect(player1).transfer(await player3.getAddress(), ethers.parseEther("100"))).wait();

    (await token.connect(player1).increaseAllowance(await market.getAddress(), ethers.parseEther("10"))).wait();
    (await token.connect(player2).increaseAllowance(await market.getAddress(), ethers.parseEther("10"))).wait();
    (await token.connect(player3).increaseAllowance(await market.getAddress(), ethers.parseEther("10"))).wait();

    (await market.connect(player1).bet(ethers.parseEther("2"), team1)).wait();
    (await market.connect(player2).bet(ethers.parseEther("10"), team2)).wait();
    (await market.connect(player1).bet(ethers.parseEther("3"), team2)).wait();
    (await market.connect(player3).bet(ethers.parseEther("3"), team1)).wait();
    (await market.connect(player1).bet(ethers.parseEther("3"), team1)).wait();

    await expect(market.connect(player1).getPotentialRewards(player1.address, "CLG")).to.be.revertedWith(
      `Winner needs to be either ${team1} or ${team2}`
    );
  });
});
