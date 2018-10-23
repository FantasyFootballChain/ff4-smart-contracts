pragma solidity ^0.4.24;
pragma experimental ABIEncoderV2;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

/**
 * @title FantasyFootballChain
 * @dev Smart contract for storing squads in FF4 app
 */
contract FantasyFootballChain is Ownable {

	using SafeMath for uint;

	address public oracleAddress;
	address public platformFeeAddress;
	uint public platformFeeRate;
	uint public squadsCount;

	mapping(uint => Squad) squads;
	mapping(address => mapping(uint => mapping(uint => mapping(uint => uint)))) userSeasonLeagueRoundSquadIndex;
	mapping(address => mapping(uint => mapping(uint => uint[]))) userSeasonLeagueSquadIndexes;
	mapping(uint => mapping(uint => mapping(uint => uint[]))) seasonLeagueRoundSquadIndexes;
	mapping(uint => mapping(uint => mapping(uint => uint))) seasonLeagueRoundSquadCount;
	mapping(uint => mapping(uint => mapping(uint => uint))) seasonLeagueRoundStake;

	enum SquadState {
		ToBeValidated,
		InvalidSeasonId,
		InvalidLeagueId,
		InvalidRoundId,
		InvalidNumberOfPlayersFromTheSameClub,
		InvalidPlayerLeague,
		InvalidNumberOfTotalPoints,
		InvalidFormation,
		InvalidTimeAfterDeadline,
		Validated,
		Lose,
		Win,
		Redeemed
	}

	struct Squad {
		uint seasonId;
		uint leagueId;
		uint roundId;
		uint captainId;
		uint stake;
		uint createdAt;
		uint lastUpdatedAt;
		uint winSumInWei;
		uint platformFeeInWei;
		SquadState state;
		bool initialized;
		address userAddress;
		uint[] playerIds;
		uint[] benchPlayerIds;
	}

	//==========
	// Mofifiers
	//==========

	/**
	 * @dev Checks that squad is in particular state
	 */
	modifier onlyInState(uint _index, SquadState _state) {
		require(_index < squadsCount);
		require(squads[_index].state == _state);
		_;
	}

	/**
	 * @dev Modifier checks that method can be called only by oracle
	 */
	modifier onlyOracle() {
		require(msg.sender == oracleAddress);
		_;
	}

	/**
	 * @dev Constructor
	 * @param _oracleAddrses oracle address who updates squads' states
	 * @param _platformFeeAddress address where platform fee from all winnings will be sent
	 * @param _platformFeeRate platform fee rate, 10000 == 100%
	 */
	constructor(
		address _oracleAddress,
		address _platformFeeAddress,
		uint _platformFeeRate
	) public {
		// validation
		require(_oracleAddress != address(0));
		require(_platformFeeAddress != address(0));
		// save contract properties
		oracleAddress = _oracleAddress;
		platformFeeAddress = _platformFeeAddress;
		platformFeeRate = _platformFeeRate;
	}

	//==============
	// Owner methods
	//==============

	/**
	 * @dev Updates oracle address. Oracle performs squad states update
	 * @param _newOracleAddress new oracle address
	 */
	function changeOracleAddress(address _newOracleAddress) external onlyOwner {
		require(_newOracleAddress != address(0));
		oracleAddress = _newOracleAddress;
	}

	/**
	 * @dev Updates platform fee address
	 * @param _newPlatformFeeAddress new platform fee address
	 */
	function changePlatformFeeAddress(address _newPlatformFeeAddress) external onlyOwner {
		require(_newPlatformFeeAddress != address(0));
		platformFeeAddress = _newPlatformFeeAddress;
	}

	/**
	 * @dev Updates platform fee rate. 10000 == 100%. Platform fee rate is taken from all winnings
	 * @param _newPlatformFeeRate new platform fee rate
	 */
	function changePlatformFeeRate(uint _newPlatformFeeRate) external onlyOwner {
		platformFeeRate = _newPlatformFeeRate;
	}

	//===============
	// Oracle methods
	//===============

	/**
	 * @dev Marks squad as invalid and refunds
	 * @param _index squad index
	 * @param _newState new squad state
	 */
	function autoMarkInvalid(
		uint _index,
		SquadState _newState
	) external onlyOracle onlyInState(_index, SquadState.ToBeValidated) {
		// validation
		require(_newState == SquadState.InvalidSeasonId ||
				_newState == SquadState.InvalidLeagueId ||
				_newState == SquadState.InvalidRoundId ||
				_newState == SquadState.InvalidNumberOfPlayersFromTheSameClub ||
				_newState == SquadState.InvalidPlayerLeague ||
				_newState == SquadState.InvalidNumberOfTotalPoints ||
				_newState == SquadState.InvalidFormation ||
				_newState == SquadState.InvalidTimeAfterDeadline);
		// update squad properties
		squads[_index].state = _newState;
		squads[_index].initialized = false;
		squads[_index].lastUpdatedAt = now;
		// refund
		squads[_index].userAddress.transfer(squads[_index].stake);
	}

	/**
	 * @dev Marks squad as valid
	 * @param _index squad index
	 */
	function autoMarkValid(uint _index) external onlyOracle onlyInState(_index, SquadState.ToBeValidated) {
		// update squad properties
		Squad storage squad = squads[_index];
		squad.state = SquadState.Validated;
		squad.lastUpdatedAt = now;
		// update sums
		seasonLeagueRoundSquadCount[squad.seasonId][squad.leagueId][squad.roundId] = seasonLeagueRoundSquadCount[squad.seasonId][squad.leagueId][squad.roundId].add(1);
		seasonLeagueRoundStake[squad.seasonId][squad.leagueId][squad.roundId] = seasonLeagueRoundStake[squad.seasonId][squad.leagueId][squad.roundId].add(msg.value);
	}

	/**
	 * @dev Sets squad's state to lose
	 * @param _index squad index
	 */
	function autoMarkLose(uint _index) external onlyOracle onlyInState(_index, SquadState.Validated) {
		// update squad properties
		squads[_index].state = SquadState.Lose;
		squads[_index].lastUpdatedAt = now;
	}

	/**
	 * @dev Sets squad's state to win
	 * @param _index squad index
	 * @param _winSumInWei win sum in wei
	 */
	function autoMarkWin(uint _index, uint _winSumInWei) external onlyOracle onlyInState(_index, SquadState.Validated) {
		// update squad properties
		squads[_index].state = SquadState.Win;
		squads[_index].winSumInWei = _winSumInWei;
		squads[_index].lastUpdatedAt = now;
	}

	//=============
	// User methods
	//=============

	/**
	 * @dev Checks whether all squads in round have terminal status
	 * @param _index squad index
	 * @return whether all squads have terminal status
	 */
	function checkAllSquadsHaveTerminalStatus(uint _index) public returns(bool) {
		// validation
		require(_index < squadsCount);
		// if squad status is ToBeValidated or Validated then not all squads are updated for current round
		bool allSquadsHaveTerminalStatus = true;
		uint[] memory squadIndexes = seasonLeagueRoundSquadIndexes[squads[_index].seasonId][squads[_index].leagueId][squads[_index].roundId];
		for(uint i = 0; i < squadIndexes.length; i++) {
			if(squads[squadIndexes[i]].state == SquadState.ToBeValidated || squads[squadIndexes[i]].state == SquadState.Validated) {
				allSquadsHaveTerminalStatus = false;
				break;
			}
		}
		return allSquadsHaveTerminalStatus;
	}

	/**
	 * @dev Creates and funds a new squad
	 * @param _seasonId season id
	 * @param _leaguedId league id
	 * @param _roundId round id
	 * @param _playerIds array of player ids in the main squad
	 * @param _benchPlayerIds array of player ids on the bench
	 * @param _captainId captain id
	 */
	function createAndFundSquad(
		uint _seasonId, 
		uint _leagueId, 
		uint _roundId,
		uint[] _playerIds,
		uint[] _benchPlayerIds,
		uint _captainId
	) external payable {
		Squad memory squad = squads[userSeasonLeagueRoundSquadIndex[msg.sender][_seasonId][_leagueId][_roundId]];
		// validation
		require(_playerIds.length == 11);
		require(_benchPlayerIds.length == 4);
		require(msg.value > 0);
		require(!squad.initialized);
		require(squad.userAddress == address(0) || squad.userAddress == msg.sender);
		// save new squad
		squad.seasonId = _seasonId;
		squad.leagueId = _leagueId;
		squad.roundId = _roundId;
		squad.captainId = _captainId;
		squad.stake = msg.value;
		squad.createdAt = now;
		squad.lastUpdatedAt = now;
		squad.state = SquadState.ToBeValidated;
		squad.initialized = true;
		squad.userAddress = msg.sender;
		squad.playerIds = _playerIds;
		squad.benchPlayerIds = _benchPlayerIds;
		// update global squads
		squads[squadsCount] = squad;
		userSeasonLeagueRoundSquadIndex[msg.sender][_seasonId][_leagueId][_roundId] = squadsCount;
		userSeasonLeagueSquadIndexes[msg.sender][_seasonId][_leagueId].push(squadsCount);
		seasonLeagueRoundSquadIndexes[_seasonId][_leagueId][_roundId].push(squadsCount);
		squadsCount = squadsCount.add(1);
	}

	/**
	 * @dev Returns total sum of stakes in wei in validated squads
	 * @param _seasonId season id
	 * @param _leagueId league id
	 * @param _roundId round id
	 * @return sum of stakes of validated squads
	 */
	function getRoundStake(uint _seasonId, uint _leagueId, uint _roundId) external returns(uint) {
		return seasonLeagueRoundStake[_seasonId][_leagueId][_roundId];
	}

	/**
	 * @dev Returns number of validated squads in round by season, league and round
	 * @param _seasonId season id
	 * @param _leagueId league id
	 * @param _roundId round id
	 * @return number of validated squads in round
	 */
	function getRoundSquadCount(uint _seasonId, uint _leagueId, uint _roundId) external returns(uint) {
		return seasonLeagueRoundSquadCount[_seasonId][_leagueId][_roundId];
	}

	/**
	 * @dev Returns array of squad indexes by season, league and round
	 * @param _seasonId season id
	 * @param _leagueId league id
	 * @param _roundId round id
	 * @return array of squad indexes
	 */
	function getRoundSquadIndexes(uint _seasonId, uint _leagueId, uint _roundId) external returns(uint[]) {
		return seasonLeagueRoundSquadIndexes[_seasonId][_leagueId][_roundId];
	}

	/**
	 * @dev Returns squad info by index
	 * @param _index squad index
	 * @return squad info
	 */
	function getSquad(uint _index) external returns(Squad) {
		require(_index < squadsCount);
		return squads[_index];
	}

	/**
	 * @dev Returns squad index by user address, season, league and round
	 * @param _userAddress user address
	 * @param _seasonId season id
	 * @param _leagueId league id
	 * @param _roundId round id
	 * @return squad index
	 */
	function getUserSquadIndex(address _userAddress, uint _seasonId, uint _leagueId, uint _roundId) external returns(uint) {
		return userSeasonLeagueRoundSquadIndex[_userAddress][_seasonId][_leagueId][_roundId];
	}

	/**
	 * @dev Returns array of squad indexes by user address, season and league
	 * @param _userAddress user address
	 * @param _seasonId season id
	 * @param _leagueId league id
	 * @return squad indexes
	 */
	function getUserSquadIndexes(address _userAddress, uint _seasonId, uint _leagueId) external returns(uint[]) {
		return userSeasonLeagueSquadIndexes[_userAddress][_seasonId][_leagueId];
	}

	/**
	 * @dev Returns result user win sum
	 * @param _index squad index
	 * @return user win sum in wei
	 */
	function getWinSum(uint _index) public onlyInState(_index, SquadState.Win) returns(uint) {
		// validation
		require(squads[_index].userAddress == msg.sender);
		require(checkAllSquadsHaveTerminalStatus(_index));
		// calculating win sum
		uint totalWinSum = 0;
		uint totalLoseSum = 0;
		uint[] memory squadIndexes = seasonLeagueRoundSquadIndexes[squads[_index].seasonId][squads[_index].leagueId][squads[_index].roundId];
		for(uint i = 0; i < squadIndexes.length; i++) {
			if(squads[squadIndexes[i]].state == SquadState.Win || squads[squadIndexes[i]].state == SquadState.Redeemed) {
				totalWinSum = totalWinSum.add(squads[squadIndexes[i]].stake);
			}
			if(squads[squadIndexes[i]].state == SquadState.Lose) {
				totalLoseSum = totalLoseSum.add(squads[squadIndexes[i]].stake);
			}
		}
		uint ratio;
		if(totalWinSum == 0) totalWinSum = 1;
		if(totalLoseSum == 0) totalLoseSum = 1;
		if(totalLoseSum > totalWinSum) {
			ratio = totalLoseSum.div(totalWinSum).mul(10000);
		} else {
			ratio = totalWinSum.div(totalLoseSum).mul(10000);
		}
		uint winSum = squads[_index].stake.add(squads[_index].stake.div(10000).mul(ratio));
		return winSum;
	}

	/**
	 * @dev Withdraws win sum if user's squad won
	 * @param _index
	 */
	function withdrawWinSum(uint _index) external onlyInState(_index, SquadState.Win) {
		// validation
		require(squads[_index].userAddress == msg.sender);
		require(checkAllSquadsHaveTerminalStatus(_index));
		// update squad properties
		uint winSumPlusFeeInWei = getWinSum(_index);
		squads[_index].state = SquadState.Redeemed;
		squads[_index].lastUpdatedAt = now;
		squads[_index].platformFeeInWei = winSumPlusFeeInWei.div(10000).mul(platformFeeRate);
		if(squads[_index].platformFeeInWei < winSumPlusFeeInWei) {
			squads[_index].winSumInWei = winSumPlusFeeInWei.sub(squads[_index].platformFeeInWei);
		}
		// transfer win sum and platform fee
		squads[_index].userAddress.transfer(squads[_index].winSumInWei);
		platformFeeAddress.transfer(squads[_index].platformFeeInWei);
	}

}