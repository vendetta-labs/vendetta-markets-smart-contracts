import BigNumber from "bignumber.js";
import { expect } from "chai";
import { ethers } from "hardhat";
import { GameMarket, VChipToken } from "../typechain-types";

const GAMEMARKET_LEFT = "Vendetta:GameMarket:Left";
const GAMEMARKET_RIGHT = "Vendetta:GameMarket:Right";
const GAMEMARKET_SCORE = "Vendetta:GameMarket:Score";
const GAMEMARKET_SCORE_NONE = "Vendetta:GameMarket:Score::None";

enum GameScore {
  None = 0,
  Left = 1,
  Right = 2,
}

async function deployVChipToken(
  totalSupply: string = "1000000"
): Promise<VChipToken> {
  const VChipToken = await ethers.getContractFactory("VChipToken");
  const chip = await VChipToken.deploy(ethers.parseEther(totalSupply));
  console.log(`Chip Addr: ${await chip.getAddress()}`);
  console.log(`Chip Decimals: ${await chip.decimals()}`);
  console.log(`Chip Total supply: ${await chip.totalSupply()}`);
  return chip;
}

async function deployGameMarket(
  left: string,
  right: string,
  options?: { chip?: string; score?: GameScore }
): Promise<GameMarket> {
  const chipAddress = options?.chip || (await deployVChipToken()).getAddress();
  const GameMarket = await ethers.getContractFactory("GameMarket");
  const gameMarket = await GameMarket.deploy(chipAddress, left, right);
  // console.log(`GameMarket Addr: ${await gameMarket.getAddress()}`);
  return gameMarket;
}

describe("GameMarket", function () {
  it("should create the game market", async function () {
    const gameMarket = await deployGameMarket("FNC", "G2");

    const [left, right, score] = await gameMarket.getGame();
    expect(left).to.equal("FNC");
    expect(right).to.equal("G2");
    expect(score).to.equal(GameScore.None);
  });

  it("the game market left side can not be null", async function () {
    const chip = await deployVChipToken();
    const GameMarket = await ethers.getContractFactory("GameMarket");

    await expect(
      GameMarket.deploy(await chip.getAddress(), GAMEMARKET_SCORE_NONE, "G2")
    ).to.be.revertedWith(
      `${GAMEMARKET_LEFT} cannot be ${GAMEMARKET_SCORE_NONE}`
    );
  });

  it("the game market right side can not be null", async function () {
    const chip = await deployVChipToken();
    const GameMarket = await ethers.getContractFactory("GameMarket");

    await expect(
      GameMarket.deploy(await chip.getAddress(), "FNC", GAMEMARKET_SCORE_NONE)
    ).to.be.revertedWith(
      `${GAMEMARKET_RIGHT} cannot be ${GAMEMARKET_SCORE_NONE}`
    );
  });

  it("the game market left and right side can not be equal", async function () {
    const chip = await deployVChipToken();
    const GameMarket = await ethers.getContractFactory("GameMarket");

    await expect(
      GameMarket.deploy(await chip.getAddress(), "FNC", "FNC")
    ).to.be.revertedWith(
      `${GAMEMARKET_LEFT} cannot be the same as ${GAMEMARKET_RIGHT}`
    );
  });

  it("admin can set the game score", async function () {
    const gameMarket1 = await deployGameMarket("FNC", "G2");
    const gameMarket2 = await deployGameMarket("TSM", "CLG");

    const tx1 = await gameMarket1.setScore(GameScore.Left);
    await tx1.wait();

    const tx2 = await gameMarket2.setScore(GameScore.Right);
    await tx2.wait();

    const [, , score1] = await gameMarket1.getGame();
    expect(score1).to.equal(GameScore.Left);

    const [, , score2] = await gameMarket2.getGame();
    expect(score2).to.equal(GameScore.Right);
  });

  it("the game score can only be Left or Right", async function () {
    const gameMarket = await deployGameMarket("FNC", "G2");

    await expect(gameMarket.setScore(GameScore.None)).to.be.revertedWith(
      `${GAMEMARKET_SCORE} cannot be ${GAMEMARKET_SCORE_NONE}`
    );
  });

  it("the game score cant be changed after it has been set", async function () {
    const gameMarket = await deployGameMarket("FNC", "G2");

    const tx = await gameMarket.setScore(GameScore.Left);
    await tx.wait();

    await expect(gameMarket.setScore(GameScore.Right)).to.be.revertedWith(
      `${GAMEMARKET_SCORE} can only be set once`
    );
  });

  it("only admin can set the game score", async function () {
    const gameMarket = await deployGameMarket("FNC", "G2");

    const guest = await ethers.provider.getSigner(1);

    await expect(
      gameMarket.connect(guest).setScore(GameScore.Left)
    ).to.be.revertedWith("Only the admin can call this function");
  });

  it("accepts bets", async function () {
    const chip = await deployVChipToken("1000");
    const gameMarket = await deployGameMarket("FNC", "G2", {
      chip: await chip.getAddress(),
    });

    const player1 = await ethers.provider.getSigner(0);
    const player2 = await ethers.provider.getSigner(1);
    const player3 = await ethers.provider.getSigner(2);

    expect(await chip.balanceOf(await player1.getAddress())).to.equal(
      ethers.parseEther("1000")
    );
    (
      await chip
        .connect(player1)
        .transfer(await player2.getAddress(), ethers.parseEther("100"))
    ).wait();
    (
      await chip
        .connect(player1)
        .transfer(await player3.getAddress(), ethers.parseEther("100"))
    ).wait();
    expect(await chip.balanceOf(await player1.getAddress())).to.equal(
      ethers.parseEther("800")
    );
    expect(await chip.balanceOf(await player2.getAddress())).to.equal(
      ethers.parseEther("100")
    );
    expect(await chip.balanceOf(await player3.getAddress())).to.equal(
      ethers.parseEther("100")
    );

    (
      await chip
        .connect(player1)
        .increaseAllowance(
          await gameMarket.getAddress(),
          ethers.parseEther("10")
        )
    ).wait();
    (
      await chip
        .connect(player2)
        .increaseAllowance(
          await gameMarket.getAddress(),
          ethers.parseEther("10")
        )
    ).wait();
    (
      await chip
        .connect(player3)
        .increaseAllowance(
          await gameMarket.getAddress(),
          ethers.parseEther("10")
        )
    ).wait();

    (
      await gameMarket
        .connect(player1)
        .bet(ethers.parseEther("2"), GameScore.Left)
    ).wait();

    (
      await gameMarket
        .connect(player2)
        .bet(ethers.parseEther("10"), GameScore.Right)
    ).wait();

    (
      await gameMarket
        .connect(player1)
        .bet(ethers.parseEther("3"), GameScore.Right)
    ).wait();

    (
      await gameMarket
        .connect(player3)
        .bet(ethers.parseEther("5"), GameScore.Left)
    ).wait();

    (
      await gameMarket
        .connect(player1)
        .bet(ethers.parseEther("3"), GameScore.Left)
    ).wait();

    expect(await chip.balanceOf(await gameMarket.getAddress())).to.equal(
      ethers.parseEther("23")
    );
    expect(await chip.balanceOf(await player1.getAddress())).to.equal(
      ethers.parseEther("792")
    );
    expect(await chip.balanceOf(await player2.getAddress())).to.equal(
      ethers.parseEther("90")
    );
    expect(await chip.balanceOf(await player3.getAddress())).to.equal(
      ethers.parseEther("95")
    );

    const bets = await gameMarket.getBets(await player1.getAddress());
    console.log("bets", bets);

    // ratio = totalPlayerAmountWinnerSide / totalMarketAmountWinnerSide

    // winAmount = totalMarketAmountLoserSide * ratio

    // return totalPlayerAmountWinnerSide + winAmount
  });
});
