require('chai').use(require('chai-as-promised')).should();

const FantasyFootballChain = artifacts.require("FantasyFootballChain");
const TicketSystem = artifacts.require("TicketSystemTestable");

contract("TicketSystem", (accounts) => {

    const ownerAddress = accounts[0];
    const oracleAddress = accounts[1];
    const platformFeeAddress = accounts[2];
    const userAddress = accounts[3];

    const initialFund = web3.toWei("0.1", "ether");
    const platformFeeRate = 1000;

    let ff4;
    let ticketSystem;

    beforeEach(async() => {
		ff4 = await FantasyFootballChain.new(oracleAddress, platformFeeAddress, platformFeeRate).should.be.fulfilled;
        await ff4.createAndFundSquad(0, 0, 0, [0,1,2,3,4,5,6,7,8,9,10], [11,12,13,14], 0, {from: userAddress, value: initialFund}).should.be.fulfilled;
        ticketSystem = await TicketSystem.new(ff4.address).should.be.fulfilled;
    });
    
    describe("constructor()", () => {
        it("should revert if ff4 address is 0x00", async() => {
            const invalidFf4Address = 0x00;
            await TicketSystem.new(invalidFf4Address).should.be.rejectedWith("revert");
        });

        it("should set contract properties", async() => {
            const ff4Address = await ticketSystem.ff4().should.be.fulfilled;
            assert.equal(ff4Address, ff4.address);
        });
    });

});