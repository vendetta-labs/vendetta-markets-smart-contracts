// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.12;

import "./ERC20/IERC20.sol";

string constant GAMEMARKET_LEFT = "Vendetta:GameMarket:Left";
string constant GAMEMARKET_RIGHT = "Vendetta:GameMarket:Right";
string constant GAMEMARKET_SCORE = "Vendetta:GameMarket:Score";
string constant GAMEMARKET_SCORE_NONE = "Vendetta:GameMarket:Score::None";

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

  modifier adminOnly() {
    require(admin == msg.sender, "Only the admin can call this function");
    _;
  }

  event SetScore(address sender, Score score);
  event NewBet(address sender, uint256 amount, Score score);

  constructor(
    address _chip_address,
    string memory _left,
    string memory _right
  ) {
    require(_chip_address != address(0), "ERC20: cant be zero address");
    require(
      keccak256(abi.encodePacked(_left)) != keccak256(abi.encodePacked(_right)),
      string.concat(
        GAMEMARKET_LEFT,
        " cannot be the same as ",
        GAMEMARKET_RIGHT
      )
    );
    require(
      keccak256(abi.encodePacked(_left)) !=
        keccak256(abi.encodePacked(GAMEMARKET_SCORE_NONE)),
      string.concat(GAMEMARKET_LEFT, " cannot be ", GAMEMARKET_SCORE_NONE)
    );
    require(
      keccak256(abi.encodePacked(_right)) !=
        keccak256(abi.encodePacked(GAMEMARKET_SCORE_NONE)),
      string.concat(GAMEMARKET_RIGHT, " cannot be ", GAMEMARKET_SCORE_NONE)
    );

    admin = msg.sender;
    chip = IERC20(_chip_address);
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
    require(
      _score != Score.None,
      string.concat(GAMEMARKET_SCORE, " cannot be ", GAMEMARKET_SCORE_NONE)
    );
    require(
      game.score == Score.None,
      string.concat(GAMEMARKET_SCORE, " can only be set once")
    );

    game.score = _score;
    emit SetScore(msg.sender, _score);
  }

  function bet(uint256 _amount, Score _score) public {
    require(
      _score != Score.None,
      string.concat(GAMEMARKET_SCORE, " cannot be ", GAMEMARKET_SCORE_NONE)
    );
    require(
      game.score == Score.None,
      string.concat(GAMEMARKET_SCORE, " is already set")
    );
    require(_amount > 0, string.concat("The bet must bet more than 0"));
    require(chip.transferFrom(msg.sender, address(this), _amount));

    totalBetsByScore[_score] += _amount;
    bets[msg.sender].push(Bet(msg.sender, _amount, _score));

    emit NewBet(msg.sender, _amount, _score);
  }
}
