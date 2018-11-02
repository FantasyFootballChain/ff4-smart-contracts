require('chai').use(require('chai-as-promised')).should();

const FantasyFootballChain = artifacts.require("FantasyFootballChain");

contract("FantasyFootballChain: Functional", (accounts) => {

    // available squad states
	const STATE_INVALID_SEASON_ID = 1;

    const ownerAddress = accounts[0];
    const oracleAddress = accounts[1];
    const platformFeeAddress = accounts[2];
    const otherAddress = accounts[3];
	const userAddress = accounts[4];
    
    const initialFund = web3.toWei("0.1", "ether");
    const platformFeeRate = 1000;

    let ff4;

    beforeEach(async() => {
        ff4 = await FantasyFootballChain.new(oracleAddress, platformFeeAddress, platformFeeRate).should.be.fulfilled;
        await ff4.createAndFundSquad(0, 0, 0, [0,1,2,3,4,5,6,7,8,9,10], [11,12,13,14], 0, {from: userAddress, value: initialFund}).should.be.fulfilled;
    });
    
    describe("onlyInState()", () => {
		it("should revert if index is greater than squads count", async() => {
			await ff4.autoMarkInvalid(1, STATE_INVALID_SEASON_ID, {from: oracleAddress}).should.be.rejectedWith("revert");
        });

        it("should revert if squad is not in the correct state", async() => {
			await ff4.autoMarkWin(0, {from: oracleAddress}).should.be.rejectedWith("revert");
        });
	});
	
	describe("onlyOracle()", () => {
		it("should revert if caller is not an oracle", async() => {
			await ff4.autoMarkInvalid(0, STATE_INVALID_SEASON_ID, {from: otherAddress}).should.be.rejectedWith("revert");
        });
	});

	describe("validIndex()", () => {
		it("should revert if squad index does not exist", async() => {
			await ff4.checkAllSquadsHaveTerminalStatus(1, {from: userAddress}).should.be.rejectedWith("revert");
        });
	});

});