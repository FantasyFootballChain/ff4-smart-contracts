require('chai').use(require('chai-as-promised')).should();

const FantasyFootballChain = artifacts.require("FantasyFootballChain");
const TicketSystem = artifacts.require("TicketSystemTestable");

contract("TicketSystem: Functional", (accounts) => {

	const ownerAddress = accounts[0];
    const oracleAddress = accounts[1];
	const platformFeeAddress = accounts[2];
	const userAddress = accounts[3];
	const adminAddress = accounts[4];
	
	const initialFund = web3.toWei("0.1", "ether");
	const platformFeeRate = 1000;

	let ff4;
    let ticketSystem;

    beforeEach(async() => {
		ff4 = await FantasyFootballChain.new(oracleAddress, platformFeeAddress, platformFeeRate).should.be.fulfilled;
        await ff4.createAndFundSquad(0, 0, 0, [0,1,2,3,4,5,6,7,8,9,10], [11,12,13,14], 0, {from: userAddress, value: initialFund}).should.be.fulfilled;
        ticketSystem = await TicketSystem.new(ff4.address).should.be.fulfilled;
	});
	
	describe("onlyAdmin()", () => {
        it("should revert if method is called not by admin", async() => {
			await ticketSystem.addAdmin(adminAddress, {from: ownerAddress}).should.be.fulfilled;
			await ticketSystem.createTicket(0, "ANY_MSG", {from: userAddress}).should.be.fulfilled;
			await ticketSystem.closeTicket(0, {from: userAddress}).should.be.rejectedWith("revert");
		});
		
		it("should execute method that can be run only by admin", async() => {
			await ticketSystem.addAdmin(adminAddress, {from: ownerAddress}).should.be.fulfilled;
			await ticketSystem.createTicket(0, "ANY_MSG", {from: userAddress}).should.be.fulfilled;
			await ticketSystem.closeTicket(0, {from: adminAddress}).should.be.fulfilled;
        });
	});
	
	describe("validTicketIndex()", () => {
        it("should revert if ticket not exists", async() => {
			await ticketSystem.createTicket(0, "ANY_MSG", {from: userAddress}).should.be.fulfilled;
			await ticketSystem.replyToTicketByUser(1, "ANY_MSG2", {from: userAddress}).should.be.rejectedWith("revert");
		});

		it("should call action if ticket exists", async() => {
			await ticketSystem.createTicket(0, "ANY_MSG", {from: userAddress}).should.be.fulfilled;
			await ticketSystem.replyToTicketByUser(0, "ANY_MSG2", {from: userAddress}).should.be.fulfilled;
		});

		it("should revert if ticket not exists and tickets count is not 0", async() => {
			await ticketSystem.createTicket(0, "ANY_MSG", {from: userAddress}).should.be.fulfilled;
			await ticketSystem.writeMessageToTicket(1, userAddress, "ANY_MSG", {from: userAddress}).should.be.rejectedWith("revert");
		});

		it("should call action if there are no tickets", async() => {
			await ticketSystem.writeMessageToTicket(1, userAddress, "ANY_MSG", {from: userAddress}).should.be.fulfilled;
		});
    });

});