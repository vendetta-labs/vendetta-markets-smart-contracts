// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.12;

import "./ERC20/IERC20.sol";

string constant GAMEMARKET_LEFT = "Vendetta:GameMarket:Left";
string constant GAMEMARKET_RIGHT = "Vendetta:GameMarket:Right";
string constant GAMEMARKET_SCORE = "Vendetta:GameMarket:Score";
string constant GAMEMARKET_SCORE_NONE = "Vendetta:GameMarket:Score::None";

uint8 constant REWARDS_PRECISION = 6;

enum Score {
  None, // 0
  Left, // 1
  Right // 2
}

struct Game {
  string left;
  string right;
  Score score;
}

struct Bet {
  address player;
  uint256 amount;
  Score score;
}

contract GameMarket {
  address public admin;
  IERC20 public chip;
  Game game;
  string right;
  mapping(Score => uint256) public totalBetsByScore;
  mapping(address => Bet[]) bets;
  mapping(address => bool) claimedRewards;

  modifier adminOnly() {
    require(admin == msg.sender, "Only the admin can call this function");
    _;
  }

  event SetScore(address sender, Score score);
  event NewBet(address sender, uint256 amount, Score score);

  constructor(address _chipAddress, string memory _left, string memory _right) {
    require(_chipAddress != address(0), "ERC20: cant be zero address");
    require(
      keccak256(abi.encodePacked(_left)) != keccak256(abi.encodePacked(_right)),
      string.concat(GAMEMARKET_LEFT, " cannot be the same as ", GAMEMARKET_RIGHT)
    );
    require(
      keccak256(abi.encodePacked(_left)) != keccak256(abi.encodePacked(GAMEMARKET_SCORE_NONE)),
      string.concat(GAMEMARKET_LEFT, " cannot be ", GAMEMARKET_SCORE_NONE)
    );
    require(
      keccak256(abi.encodePacked(_right)) != keccak256(abi.encodePacked(GAMEMARKET_SCORE_NONE)),
      string.concat(GAMEMARKET_RIGHT, " cannot be ", GAMEMARKET_SCORE_NONE)
    );

    admin = msg.sender;
    chip = IERC20(_chipAddress);
    game = Game(_left, _right, Score.None);
  }

  function getGame() public view returns (Game memory) {
    return game;
  }

  function winner() public view returns (string memory) {
    if (game.score == Score.Left) {
      return game.left;
    } else if (game.score == Score.Right) {
      return game.right;
    } else {
      return GAMEMARKET_SCORE_NONE;
    }
  }

  function getBets(address _player) public view returns (Bet[] memory) {
    return bets[_player];
  }

  function getMyBets() public view returns (Bet[] memory) {
    return getBets(msg.sender);
  }

  function setScore(Score _score) public adminOnly {
    require(_score != Score.None, string.concat(GAMEMARKET_SCORE, " cannot be ", GAMEMARKET_SCORE_NONE));
    require(game.score == Score.None, string.concat(GAMEMARKET_SCORE, " can only be set once"));

    game.score = _score;
    emit SetScore(msg.sender, _score);
  }

  function bet(uint256 _amount, Score _score) public {
    require(_score != Score.None, string.concat(GAMEMARKET_SCORE, " cannot be ", GAMEMARKET_SCORE_NONE));
    require(game.score == Score.None, string.concat(GAMEMARKET_SCORE, " is already set"));
    require(_amount > 0, string.concat("The bet must bet more than 0"));
    require(chip.transferFrom(msg.sender, address(this), _amount));

    totalBetsByScore[_score] += _amount;
    bets[msg.sender].push(Bet(msg.sender, _amount, _score));

    emit NewBet(msg.sender, _amount, _score);
  }

  function getRewards(address _player) public view returns (uint256) {
    require(game.score != Score.None, string.concat(GAMEMARKET_SCORE, " is not settled yet"));

    uint256 _lostBetTotal = 0;
    uint256 _wonBetTotal = 0;
    Bet[] memory _bets = bets[_player];
    for (uint256 i = 0; i < _bets.length; i++) {
      Bet memory _bet = _bets[i];
      if (_bet.score == game.score) {
        _wonBetTotal += _bet.amount;
      } else {
        _lostBetTotal += _bet.amount;
      }
    }

    uint256 _wonBetShare = (_wonBetTotal * (10 ** REWARDS_PRECISION)) / totalBetsByScore[game.score];
    uint256 _rewardTotal = 0;
    if (game.score != Score.Left) {
      _rewardTotal = (_wonBetShare * totalBetsByScore[Score.Left]) / (10 ** REWARDS_PRECISION);
    }
    if (game.score != Score.Right) {
      _rewardTotal = (_wonBetShare * totalBetsByScore[Score.Right]) / (10 ** REWARDS_PRECISION);
    }

    return _wonBetTotal + _rewardTotal;
  }

  function getMyRewards() public view returns (uint256) {
    return getRewards(msg.sender);
  }

  function claimRewards() public {
    require(game.score != Score.None, string.concat(GAMEMARKET_SCORE, " is not settled yet"));
    require(!claimedRewards[msg.sender], string.concat("Rewards already claimed"));

    uint256 _rewards = getRewards(msg.sender);
    require(_rewards > 0, string.concat("No rewards to claim"));

    claimedRewards[msg.sender] = true;
    require(chip.transfer(msg.sender, _rewards));
  }
}
