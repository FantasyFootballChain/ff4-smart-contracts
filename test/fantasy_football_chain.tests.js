require('chai').use(require('chai-as-promised')).should();
const { arrayOfBNToArray } = require('./util/helpers.js');

const FantasyFootballChain = artifacts.require("FantasyFootballChain");

/**
 * Returns squad by index 
 */
async function getSquad(ff4, index) {
	let squad = {};
	// finance info
	const financeInfo = await ff4.getSquadFinanceInfo(index);
	squad.stake = financeInfo[0];
	squad.winSumInWei = financeInfo[1];
	squad.platformFeeInWei = financeInfo[2];
	// players info
	const playersInfo = await ff4.getSquadPlayersInfo(index);
	squad.captainId = playersInfo[0];
	squad.playerIds = arrayOfBNToArray(playersInfo[1]);
	squad.benchPlayerIds = arrayOfBNToArray(playersInfo[2]);
	// system info
	const systemInfo = await ff4.getSquadSystemInfo(index);
	squad.seasonId = systemInfo[0];
	squad.leagueId = systemInfo[1];
	squad.roundId = systemInfo[2];
	squad.userAddress = systemInfo[3];
	squad.state = systemInfo[4];
	squad.initialized = systemInfo[5];
	// time info
	const timeInfo = await ff4.getSquadTimeInfo(index);
	squad.createdAt = timeInfo[0];
	squad.lastUpdatedAt = timeInfo[1];
	return squad;
}

contract("FantasyFootballChain", (accounts) => {

	// available squad states
	const STATE_TO_BE_VALIDATED = 0;
	const STATE_INVALID_SEASON_ID = 1;
	const STATE_INVALID_LEAGUE_ID = 2;
	const STATE_INVALID_ROUND_ID = 3;
	const STATE_INVALID_NUMBER_OF_PLAYERS_FROM_THE_SAME_CLUB = 4;
	const STATE_INVALID_PLAYER_LEAGUE = 5;
	const STATE_INVALID_NUMBER_OF_TOTAL_POINTS = 6;
	const STATE_INVALID_FORMATION = 7;
	const STATE_INVALID_TIME_AFTER_DEADLINE = 8;
	const STATE_VALIDATED = 9;
	const STATE_LOSE = 10;
	const STATE_WIN = 11;
	const STATE_REDEEMED = 12;

    const ownerAddress = accounts[0];
    const oracleAddress = accounts[1];
	const platformFeeAddress = accounts[2];
	const otherAddress = accounts[3];
	const userAddress = accounts[4];
	const userAddress2 = accounts[5];

	const initialFund = web3.toWei("0.1", "ether");
    const platformFeeRate = 1000;

	let ff4;

    beforeEach(async() => {
		ff4 = await FantasyFootballChain.new(oracleAddress, platformFeeAddress, platformFeeRate).should.be.fulfilled;
		await ff4.createAndFundSquad(0, 0, 0, [0,1,2,3,4,5,6,7,8,9,10], [11,12,13,14], 0, {from: userAddress, value: initialFund}).should.be.fulfilled;
	});

	describe("autoMarkInvalid()", () => {
		it("should revert if new state is not invalid", async() => {
			await ff4.autoMarkInvalid(0, STATE_VALIDATED, {from: oracleAddress}).should.be.rejectedWith("revert");
		});

		it("should update squad properties", async() => {
			const squadBefore = await getSquad(ff4, 0);
			await ff4.autoMarkInvalid(0, STATE_INVALID_SEASON_ID, {from: oracleAddress}).should.be.fulfilled;
			const squadAfter = await getSquad(ff4, 0);
			assert.equal(squadAfter.state, STATE_INVALID_SEASON_ID);
			assert.equal(squadAfter.initialized, false);
			assert.notEqual(squadAfter.lastUpdatedAt, squadBefore.lastUpdatedAt);
		});

		it("should refund user", async() => {
			const userBalanceBefore = web3.eth.getBalance(userAddress);
			await ff4.autoMarkInvalid(0, STATE_INVALID_SEASON_ID, {from: oracleAddress}).should.be.fulfilled;
			const userBalanceAfter = web3.eth.getBalance(userAddress);
			assert.equal(userBalanceAfter - userBalanceBefore, initialFund);
		});
	});

	describe("autoMarkLose()", () => {
		it("should update squad properties", async() => {
			await ff4.autoMarkValid(0, {from: oracleAddress}).should.be.fulfilled;
			const squadBefore = await getSquad(ff4, 0);
			await ff4.autoMarkLose(0, {from: oracleAddress}).should.be.fulfilled;
			const squadAfter = await getSquad(ff4, 0);
			assert.equal(squadAfter.state, STATE_LOSE);
			assert.notEqual(squadAfter.lastUpdatedAt, squadBefore.lastUpdatedAt);
		});
	});

	describe("autoMarkValid()", () => {
		it("should update squad properties", async() => {
			const squadBefore = await getSquad(ff4, 0);
			await ff4.autoMarkValid(0, {from: oracleAddress}).should.be.fulfilled;
			const squadAfter = await getSquad(ff4, 0);
			assert.equal(squadAfter.state, STATE_VALIDATED);
			assert.notEqual(squadAfter.lastUpdatedAt, squadBefore.lastUpdatedAt);
		});

		it("should update global round values", async() => {
			assert.equal(await ff4.getRoundSquadCount(0,0,0), 0);
			assert.equal(await ff4.getRoundStake(0,0,0), 0);
			await ff4.autoMarkValid(0, {from: oracleAddress}).should.be.fulfilled;
			assert.equal(await ff4.getRoundSquadCount(0,0,0), 1);
			assert.equal(await ff4.getRoundStake(0,0,0), initialFund);
		});
	});

	describe("autoMarkWin()", () => {
		it("should update squad properties", async() => {
			await ff4.autoMarkValid(0, {from: oracleAddress}).should.be.fulfilled;
			const squadBefore = await getSquad(ff4, 0);
			await ff4.autoMarkWin(0, {from: oracleAddress}).should.be.fulfilled;
			const squadAfter = await getSquad(ff4, 0);
			assert.equal(squadAfter.state, STATE_WIN);
			assert.notEqual(squadAfter.lastUpdatedAt, squadBefore.lastUpdatedAt);
		});
	});

    describe("constructor()", () => {
        it("should revert if oracle address is 0x00", async() => {
            const invalidOracleAddress = 0x00;
            await FantasyFootballChain.new(invalidOracleAddress, platformFeeAddress, platformFeeRate).should.be.rejectedWith("revert");
        });

        it("should revert if platform fee address is 0x00", async() => {
            const invalidPlatformFeeAddress = 0x00;
            await FantasyFootballChain.new(oracleAddress, invalidPlatformFeeAddress, platformFeeRate).should.be.rejectedWith("revert");
        });

        it("should save contract properties", async() => {
            const ff4 = await FantasyFootballChain.new(oracleAddress, platformFeeAddress, platformFeeRate).should.be.fulfilled;
            assert.equal(await ff4.oracleAddress(), oracleAddress);
            assert.equal(await ff4.platformFeeAddress(), platformFeeAddress);
            assert.equal(await ff4.platformFeeRate(), platformFeeRate);
        });
    });

    describe("changeOracleAddress()", () => {
        it("should revert if new oracle address is 0x00", async() => {
			const invalidOracleAddress = 0x00;
			await ff4.changeOracleAddress(invalidOracleAddress, {from: ownerAddress}).should.be.rejectedWith("revert");
		});
		
		it("should update oracle address", async() => {
			await ff4.changeOracleAddress(otherAddress, {from: ownerAddress}).should.be.fulfilled;
			const newOracleAddress = await ff4.oracleAddress();
			assert.equal(newOracleAddress, otherAddress);
        });
	});
	
	describe("changePlatformFeeAddress()", () => {
        it("should revert if new platform fee address is 0x00", async() => {
			const invalidPlatformFeeAddress = 0x00;
			await ff4.changePlatformFeeAddress(invalidPlatformFeeAddress, {from: ownerAddress}).should.be.rejectedWith("revert");
		});
		
		it("should update platform fee address", async() => {
			await ff4.changePlatformFeeAddress(otherAddress, {from: ownerAddress}).should.be.fulfilled;
			const newPlatformFeeAddress = await ff4.platformFeeAddress();
			assert.equal(newPlatformFeeAddress, otherAddress);
        });
	});
	
	describe("changePlatformFeeRate()", () => {
		it("should update platform fee rate", async() => {
			await ff4.changePlatformFeeRate(1, {from: ownerAddress}).should.be.fulfilled;
			const newPlatformFeeRate = await ff4.platformFeeRate();
			assert.equal(newPlatformFeeRate, 1);
        });
	});
	
	describe("checkAllSquadsHaveTerminalStatus()", () => {
		it("should return false if one of the squads is in state to be validated", async() => {
			const allSquadsHaveTerminalStatus = await ff4.checkAllSquadsHaveTerminalStatus(0);
			assert.equal(allSquadsHaveTerminalStatus, false);
		});
		
		it("should return false if one of the squads is in state validated", async() => {
			await ff4.autoMarkValid(0, {from: oracleAddress}).should.be.fulfilled;
			const allSquadsHaveTerminalStatus = await ff4.checkAllSquadsHaveTerminalStatus(0);
			assert.equal(allSquadsHaveTerminalStatus, false);
		});
		
		it("should return true if all squads have terminal state", async() => {
			await ff4.autoMarkValid(0, {from: oracleAddress}).should.be.fulfilled;
			await ff4.autoMarkWin(0, {from: oracleAddress}).should.be.fulfilled;
			const allSquadsHaveTerminalStatus = await ff4.checkAllSquadsHaveTerminalStatus(0);
			assert.equal(allSquadsHaveTerminalStatus, true);
        });
	});
	
	describe("createAndFundSquad()", () => {
		it("should revert if players length is not 11", async() => {
			const invalidArrayOfPlayers = [];
			await ff4.createAndFundSquad(0,0,0,invalidArrayOfPlayers,[0,1,2,3],0,{from: userAddress, value: initialFund}).should.be.rejectedWith("revert");
		});

		it("should revert if bench players length is not 4", async() => {
			const invalidArrayOfBenchPlayers = [];
			await ff4.createAndFundSquad(0,0,0,[0,1,2,3,4,5,6,7,8,9,10],invalidArrayOfBenchPlayers,0,{from: userAddress, value: initialFund}).should.be.rejectedWith("revert");
		});

		it("should revert if msg value is 0", async() => {
			const invalidMsgValue = 0;
			await ff4.createAndFundSquad(0,0,0,[0,1,2,3,4,5,6,7,8,9,10],[11,12,13,14],0,{from: userAddress, value: invalidMsgValue}).should.be.rejectedWith("revert");
		});

		it("should update squad properties", async() => {
			await ff4.createAndFundSquad(0,1,2,[0,1,2,3,4,5,6,7,8,9,10],[11,12,13,14],0,{from: userAddress, value: initialFund}).should.be.fulfilled;
			const squad = await getSquad(ff4, 1);
			assert.equal(squad.seasonId, 0);
			assert.equal(squad.leagueId, 1);
			assert.equal(squad.roundId, 2);
			assert.equal(squad.captainId, 0);
			assert.equal(squad.stake, initialFund);
			assert.notEqual(squad.createdAt, 0);
			assert.notEqual(squad.lastUpdatedAt, 0);
			assert.equal(squad.state, STATE_TO_BE_VALIDATED);
			assert.equal(squad.initialized, true);
			assert.equal(squad.userAddress, userAddress);
			assert.deepEqual(squad.playerIds, [0,1,2,3,4,5,6,7,8,9,10]);
			assert.deepEqual(squad.benchPlayerIds, [11,12,13,14]);
		});

		it("should update global squad properties", async() => {
			const squad = await getSquad(ff4, 0);
			const userSquadIndex = await ff4.getUserSquadIndex(userAddress, 0, 0, 0);
			const userSquadIndexes = await ff4.getUserSquadIndexes(userAddress, 0, 0);
			const roundSquadIndexes = await ff4.getRoundSquadIndexes(0, 0, 0);
			const squadsCount = await ff4.squadsCount();

			assert.equal(squad.initialized, true);
			assert.equal(userSquadIndex, 0);
			assert.deepEqual(arrayOfBNToArray(userSquadIndexes), [0]);
			assert.deepEqual(arrayOfBNToArray(roundSquadIndexes), [0]);
			assert.equal(squadsCount, 1);
		});
	});
	
	describe("getRoundStake()", () => {
		it("should return total sum of stakes in round", async() => {
			await ff4.autoMarkValid(0, {from: oracleAddress}).should.be.fulfilled;
			const sum = await ff4.getRoundStake(0,0,0);
			assert.equal(sum, initialFund);
        });
	});

	describe("getRoundSquadCount()", () => {
		it("should return number of validated squads in round", async() => {
			await ff4.autoMarkValid(0, {from: oracleAddress}).should.be.fulfilled;
			const count = await ff4.getRoundSquadCount(0,0,0);
			assert.equal(count, 1);
        });
	});

	describe("getRoundSquadIndexes()", () => {
		it("should return array of squad indexes in round", async() => {
			const indexes = await ff4.getRoundSquadIndexes(0,0,0);
			assert.deepEqual(arrayOfBNToArray(indexes), [0]);
        });
	});

	describe("getSquadFinanceInfo()", () => {
		it("should return squad finance info", async() => {
			const financeInfo = await ff4.getSquadFinanceInfo(0);
			assert.equal(financeInfo[0], initialFund);
			assert.equal(financeInfo[1], 0);
			assert.equal(financeInfo[2], 0);
        });
	});

	describe("getSquadPlayersInfo()", () => {
		it("should return squad players info", async() => {
			const playersInfo = await ff4.getSquadPlayersInfo(0);
			assert.equal(playersInfo[0], 0);
			assert.deepEqual(arrayOfBNToArray(playersInfo[1]), [0,1,2,3,4,5,6,7,8,9,10]);
			assert.deepEqual(arrayOfBNToArray(playersInfo[2]), [11,12,13,14]);
        });
	});

	describe("getSquadSystemInfo()", () => {
		it("should return squad system info", async() => {
			const systemInfo = await ff4.getSquadSystemInfo(0);
			assert.equal(systemInfo[0], 0);
			assert.equal(systemInfo[1], 0);
			assert.equal(systemInfo[2], 0);
			assert.equal(systemInfo[3], userAddress);
			assert.equal(systemInfo[4], STATE_TO_BE_VALIDATED);
			assert.equal(systemInfo[5], true);
        });
	});

	describe("getSquadTimeInfo()", () => {
		it("should return squad time info", async() => {
			const timeInfo = await ff4.getSquadTimeInfo(0);
			assert.notEqual(timeInfo[0], 0);
			assert.notEqual(timeInfo[1], 0);
        });
	});

	describe("getUserSquadIndex()", () => {
		it("should return squad index by user address and match credentials", async() => {
			const index = await ff4.getUserSquadIndex(userAddress, 0, 0, 0);
			assert.equal(index, 0);
        });
	});

	describe("getUserSquadIndexes()", () => {
		it("should return all squad indexes for user address in league", async() => {
			const indexes = await ff4.getUserSquadIndexes(userAddress, 0, 0);
			assert.deepEqual(arrayOfBNToArray(indexes), [0]);
        });
	});

	describe("getWinSum()", () => {
		it("should revert if caller is not a squad owner", async() => {
			await ff4.autoMarkValid(0, {from: oracleAddress}).should.be.fulfilled;
			await ff4.autoMarkWin(0, {from: oracleAddress}).should.be.fulfilled;
			await ff4.getWinSum(0, {from: otherAddress}).should.be.rejectedWith("revert");
		});
		
		it("should revert if not all squads have terminal status", async() => {
			// mark squad #0 as win
			await ff4.autoMarkValid(0, {from: oracleAddress}).should.be.fulfilled;
			await ff4.autoMarkWin(0, {from: oracleAddress}).should.be.fulfilled;
			// other user creates squad #1 in to be validated state
			await ff4.createAndFundSquad(0, 0, 0, [0,1,2,3,4,5,6,7,8,9,10], [11,12,13,14], 0, {from: otherAddress, value: initialFund}).should.be.fulfilled;
			
			await ff4.getWinSum(0, {from: userAddress}).should.be.rejectedWith("revert");
		});
		
		it("should return win sum when total lose sum > total win sum", async() => {
			// mark squad #0 as win
			await ff4.autoMarkValid(0, {from: oracleAddress}).should.be.fulfilled;
			await ff4.autoMarkWin(0, {from: oracleAddress}).should.be.fulfilled;
			// user2 creates squad #1, oracle marks it as win
			await ff4.createAndFundSquad(0, 0, 0, [0,1,2,3,4,5,6,7,8,9,10], [11,12,13,14], 0, {from: userAddress2, value: initialFund}).should.be.fulfilled;
			await ff4.autoMarkValid(1, {from: oracleAddress}).should.be.fulfilled;
			await ff4.autoMarkWin(1, {from: oracleAddress}).should.be.fulfilled;
			// other user creates squad #2 and funds 3 times more
			await ff4.createAndFundSquad(0, 0, 0, [0,1,2,3,4,5,6,7,8,9,10], [11,12,13,14], 0, {from: otherAddress, value: initialFund * 3}).should.be.fulfilled;
			await ff4.autoMarkValid(2, {from: oracleAddress}).should.be.fulfilled;
			await ff4.autoMarkLose(2, {from: oracleAddress}).should.be.fulfilled;
			// user2 redeems prize
			await ff4.withdrawWinSum(1, {from: userAddress2}).should.be.fulfilled;

			const winSum = await ff4.getWinSum(0, {from: userAddress});
			assert.equal(winSum.toNumber(), initialFund * 2);
		});
		
		it("should return win sum when total win sum > total lose sum", async() => {
			// mark squad #0 as win
			await ff4.autoMarkValid(0, {from: oracleAddress}).should.be.fulfilled;
			await ff4.autoMarkLose(0, {from: oracleAddress}).should.be.fulfilled;
			// other user creates squad #1 and fund 2 times more
			await ff4.createAndFundSquad(0, 0, 0, [0,1,2,3,4,5,6,7,8,9,10], [11,12,13,14], 0, {from: otherAddress, value: initialFund * 2}).should.be.fulfilled;
			await ff4.autoMarkValid(1, {from: oracleAddress}).should.be.fulfilled;
			await ff4.autoMarkWin(1, {from: oracleAddress}).should.be.fulfilled;

			const winSum = await ff4.getWinSum(1, {from: otherAddress});
			assert.equal(winSum.toNumber(), initialFund * 2 + +initialFund);
		});
		
		it("should return win sum when there is only 1 winner", async() => {
			// mark squad #0 as win
			await ff4.autoMarkValid(0, {from: oracleAddress}).should.be.fulfilled;
			await ff4.autoMarkWin(0, {from: oracleAddress}).should.be.fulfilled;

			const winSum = await ff4.getWinSum(0, {from: userAddress});
			assert.equal(winSum.toNumber(), initialFund);
		});
	});

	describe("withdrawWinSum()", () => {
		it("should revert if caller is not a squad owner", async() => {
			await ff4.autoMarkValid(0, {from: oracleAddress}).should.be.fulfilled;
			await ff4.autoMarkWin(0, {from: oracleAddress}).should.be.fulfilled;
			await ff4.withdrawWinSum(0, {from: otherAddress}).should.be.rejectedWith("revert");
		});

		it("should revert if not all squads have terminal status", async() => {
			// create squad #1
			await ff4.createAndFundSquad(0, 0, 0, [0,1,2,3,4,5,6,7,8,9,10], [11,12,13,14], 0, {from: userAddress, value: initialFund}).should.be.fulfilled;
			// mark squad #0 as win
			await ff4.autoMarkValid(0, {from: oracleAddress}).should.be.fulfilled;
			await ff4.autoMarkWin(0, {from: oracleAddress}).should.be.fulfilled;

			await ff4.withdrawWinSum(0, {from: userAddress}).should.be.rejectedWith("revert");
		});

		it("should update squad properties", async() => {
			await ff4.autoMarkValid(0, {from: oracleAddress}).should.be.fulfilled;
			await ff4.autoMarkWin(0, {from: oracleAddress}).should.be.fulfilled;

			const squadBefore = await getSquad(ff4, 0);
			await ff4.withdrawWinSum(0, {from: userAddress}).should.be.fulfilled;

			const squadAfter = await getSquad(ff4, 0);
			assert.equal(squadAfter.state, STATE_REDEEMED);
			assert.notEqual(squadAfter.lastUpdatedAt, squadBefore.lastUpdatedAt);
			assert.equal(squadAfter.platformFeeInWei, web3.toWei("0.01", "ether"));
			assert.equal(squadAfter.winSumInWei, web3.toWei("0.09", "ether"));
		});

		it("should transfer funds", async() => {
			await ff4.autoMarkValid(0, {from: oracleAddress}).should.be.fulfilled;
			await ff4.autoMarkWin(0, {from: oracleAddress}).should.be.fulfilled;

			const userBalanceBefore = web3.eth.getBalance(userAddress);
			const platformFeeBalanceBefore = web3.eth.getBalance(platformFeeAddress);
			await ff4.withdrawWinSum(0, {from: userAddress}).should.be.fulfilled;

			const userBalanceAfter = web3.eth.getBalance(userAddress);
			const platformFeeBalanceAfter = web3.eth.getBalance(platformFeeAddress);

			assert.isTrue(userBalanceAfter > userBalanceBefore);
			assert.equal(platformFeeBalanceAfter - platformFeeBalanceBefore, web3.toWei("0.01", "ether"));
		});
	});

});