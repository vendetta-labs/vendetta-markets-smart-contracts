// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

import "./ERC20/IERC20.sol";
import "./Oracle.sol";

/// @dev The precision used for rewards calculations
uint8 constant REWARDS_PRECISION = 6;

/// @title A bet placed by a player
struct Bet {
  /// The address of the player
  address player;
  /// The amount of tokens bet
  uint256 amount;
  /// The team the player bet on
  string team;
}

/// @title The Market contract used for betting
contract Market {
  /// @dev The admin of the contract
  address admin;
  /// @dev The ERC20 token used for betting
  IERC20 public token;
  /// @dev The Oracle contract used for settling the market and metadata
  Oracle public oracle;
  /// @dev The total amount of bets for each team
  mapping(string => uint256) public totalBetsByTeam;
  /// @dev The list of bets for each player
  mapping(address => Bet[]) public bets;
  /// @dev The list of players that have claimed their rewards
  mapping(address => bool) claimedRewards;

  /// EVENTS ///

  /// @dev Emitted when a new bet is placed
  event NewBet(address sender, Bet bet);

  /// @dev Emitted when a player claims their rewards
  event ClaimedRewards(address sender, uint256 amount);

  /// MODIFIERS ///

  /// @dev Only the admin can call this function
  modifier adminOnly() {
    require(admin == msg.sender, "Only the admin can call this function");
    _;
  }

  /// CONSTRUCTOR ///

  /// Creates a new market
  ///
  /// @param _tokenAdress The address of the ERC20 token to use for betting
  /// @param _oracleAddress The address of the Oracle contract to use for settling the market and metadata
  ///
  /// Requirements:
  /// - `_tokenAdress` cannot be the zero address
  /// - `_oracleAddress` cannot be the zero address
  constructor(address _tokenAdress, address _oracleAddress) {
    require(_tokenAdress != address(0), "ERC20: cant be zero address");
    require(_oracleAddress != address(0), "Oracle: cant be zero address");

    admin = msg.sender;
    token = IERC20(_tokenAdress);
    oracle = Oracle(_oracleAddress);
  }

  /// GETTERS ///

  /// Returns the winner of the market
  ///
  /// @return The winner of the market
  function winner() public view returns (string memory) {
    return oracle.getWinner();
  }

  /// Returns the list of bets for a player
  ///
  /// @param _player The address of the player
  /// @return The list of bets for the player
  function getBets(address _player) public view returns (Bet[] memory) {
    return bets[_player];
  }

  /// Returns the list of bets for the sender
  ///
  /// @dev This function is a wrapper for `getBets(address)`
  ///
  /// @return The list of bets for the sender
  function getMyBets() public view returns (Bet[] memory) {
    return getBets(msg.sender);
  }

  /// Returns weather a player has claimed their rewards
  ///
  /// @param _player The address of the player
  /// @return Weather the player has claimed their rewards
  function hasClaimedRewards(address _player) public view returns (bool) {
    return claimedRewards[_player];
  }

  /// Returns the potential rewards for a player
  ///
  /// @param _player The address of the player
  /// @param _winner The possible winner of the market
  /// @return The potential rewards for the player
  ///
  /// Requirements:
  /// - `_winner` cannot be empty
  /// - `_winner` needs to be either `oracle.team1()` or `oracle.team2()`
  function getPotentialRewards(address _player, string memory _winner) public view returns (uint256) {
    require(keccak256(abi.encodePacked(_winner)) != keccak256(abi.encodePacked("")), "Winner can't be empty");
    string memory _team1 = oracle.team1();
    string memory _team2 = oracle.team2();
    require(
      keccak256(abi.encodePacked(_winner)) == keccak256(abi.encodePacked(_team1)) ||
        keccak256(abi.encodePacked(_winner)) == keccak256(abi.encodePacked(_team2)),
      string.concat("Winner needs to be either ", _team1, " or ", _team2)
    );

    uint256 _lostBetTotal = 0;
    uint256 _wonBetTotal = 0;
    Bet[] memory _bets = bets[_player];
    for (uint256 i = 0; i < _bets.length; i++) {
      Bet memory _bet = _bets[i];
      if (keccak256(abi.encodePacked(_bet.team)) == keccak256(abi.encodePacked(_winner))) {
        _wonBetTotal += _bet.amount;
      } else {
        _lostBetTotal += _bet.amount;
      }
    }

    uint256 _wonBetShare = (_wonBetTotal * (10 ** REWARDS_PRECISION)) / totalBetsByTeam[_winner];
    uint256 _rewardTotal = 0;

    if (keccak256(abi.encodePacked(_winner)) != keccak256(abi.encodePacked(_team1))) {
      _rewardTotal = (_wonBetShare * totalBetsByTeam[_team1]) / (10 ** REWARDS_PRECISION);
    }

    if (keccak256(abi.encodePacked(_winner)) != keccak256(abi.encodePacked(_team2))) {
      _rewardTotal = (_wonBetShare * totalBetsByTeam[_team2]) / (10 ** REWARDS_PRECISION);
    }

    return _wonBetTotal + _rewardTotal;
  }

  /// Returns the settled rewards of a player
  ///
  /// @dev This function proxies through `getPotentialRewards(_player, oracle.winner())`
  /// @dev This function reverts if the market is not settled
  ///
  /// @param _player The address of the player
  /// @return The settled rewards of the player
  ///
  /// Requirements:
  /// - The market needs to be settled
  function getRewards(address _player) public view returns (uint256) {
    require(oracle.hasWinner(), "Market is not settled yet");

    string memory _winner = oracle.getWinner();

    return getPotentialRewards(_player, _winner);
  }

  /// Returns the settled rewards of the sender
  ///
  /// @dev This function is a wrapper for `getRewards(address)`
  ///
  /// @return The settled rewards of the sender
  function getMyRewards() public view returns (uint256) {
    return getRewards(msg.sender);
  }

  /// ACTIONS ///

  /// Places a bet on a team for the sender
  ///
  /// @dev This function reverts if the market is settled
  ///
  /// @param _amount The amount to bet
  /// @param _team The team to bet on
  ///
  /// Requirements:
  /// - `_team` cannot be empty
  /// - `_team` needs to be either `oracle.team1()` or `oracle.team2()`
  /// - `_amount` needs to be more than 0
  /// - `oracle.hasWinner()` needs to be false
  function bet(uint256 _amount, string memory _team) public {
    require(!oracle.hasWinner(), "Market is settled");
    require(keccak256(abi.encodePacked(_team)) != keccak256(abi.encodePacked("")), "Team can't be empty");
    string memory _team1 = oracle.team1();
    string memory _team2 = oracle.team2();
    require(
      keccak256(abi.encodePacked(_team)) == keccak256(abi.encodePacked(_team1)) ||
        keccak256(abi.encodePacked(_team)) == keccak256(abi.encodePacked(_team2)),
      string.concat("Team needs to be either ", _team1, " or ", _team2)
    );
    require(_amount > 0, "The bet must bet more than 0");
    require(token.transferFrom(msg.sender, address(this), _amount));

    totalBetsByTeam[_team] += _amount;
    Bet memory _bet = Bet(msg.sender, _amount, _team);
    bets[msg.sender].push(_bet);

    emit NewBet(msg.sender, _bet);
  }

  /// Claims the rewards of the sender
  ///
  /// @dev This function reverts if the market is not settled
  /// @dev This function reverts if the sender has already claimed their rewards
  /// @dev This function reverts if the sender has no rewards to claim
  ///
  /// Requirements:
  /// - `oracle.hasWinner()` needs to be true
  /// - `claimedRewards[msg.sender]` needs to be false
  /// - `getRewards(msg.sender)` needs to be more than 0
  function claimRewards() public {
    require(oracle.hasWinner(), "Market is not settled yet");
    require(!claimedRewards[msg.sender], "Rewards already claimed");

    uint256 _rewards = getRewards(msg.sender);
    require(_rewards > 0, "No rewards to claim");

    claimedRewards[msg.sender] = true;
    require(token.transfer(msg.sender, _rewards));

    emit ClaimedRewards(msg.sender, _rewards);
  }
}
