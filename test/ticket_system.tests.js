require('chai').use(require('chai-as-promised')).should();
const { increaseTime } = require('./util/helpers');

const FantasyFootballChain = artifacts.require("FantasyFootballChain");
const TicketSystem = artifacts.require("TicketSystemTestable");

contract("TicketSystem", (accounts) => {

    // ticket states
    STATE_UNINITIALIZED = 0;
    STATE_OPEN = 1;
    STATE_CLOSED = 2;

    const ownerAddress = accounts[0];
    const oracleAddress = accounts[1];
    const platformFeeAddress = accounts[2];
    const userAddress = accounts[3];
    const userAddress2 = accounts[4];
    const adminAddress = accounts[5];

    const initialFund = web3.toWei("0.1", "ether");
    const platformFeeRate = 1000;

    let ff4;
    let ticketSystem;

    beforeEach(async() => {
		ff4 = await FantasyFootballChain.new(oracleAddress, platformFeeAddress, platformFeeRate).should.be.fulfilled;
        await ff4.createAndFundSquad(0, 0, 0, [0,1,2,3,4,5,6,7,8,9,10], [11,12,13,14], 0, {from: userAddress, value: initialFund}).should.be.fulfilled;
        ticketSystem = await TicketSystem.new(ff4.address).should.be.fulfilled;
    });
    
    describe("addAdmin()", () => {
        it("should revert if admin address is 0x00", async() => {
            const invalidAdminAddress = 0x00;
            await ticketSystem.addAdmin(invalidAdminAddress, {from: ownerAddress}).should.be.rejectedWith("revert");
        });

        it("should add a new admin", async() => {
            await ticketSystem.addAdmin(adminAddress, {from: ownerAddress}).should.be.fulfilled;
            assert.equal(await ticketSystem.adminActive(adminAddress), true);
            assert.equal(await ticketSystem.admins(0), adminAddress);
        });
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

    describe("closeTicket()", () => {
        it("should close ticket", async() => {
            await ticketSystem.addAdmin(adminAddress, {from: ownerAddress}).should.be.fulfilled;
            await ticketSystem.createTicket(0, "ANY_MSG", {from: userAddress}).should.be.fulfilled;
            
            const ticketBefore = await ticketSystem.tickets(0);
            assert.equal(ticketBefore[4], STATE_OPEN);

			await increaseTime(1);
            await ticketSystem.closeTicket(0, {from: adminAddress}).should.be.fulfilled;

            const ticketAfter = await ticketSystem.tickets(0);
            assert.equal(ticketAfter[4], STATE_CLOSED);
            assert.isTrue(ticketAfter[2] > ticketBefore[2]);
        });
    });

    describe("createTicket()", () => {
        it("should revert if ticket is created not by the squad owner", async() => {
            await ticketSystem.createTicket(0, "ANY_MSG", {from: userAddress2}).should.be.rejectedWith("revert");
        });

        it("should create and save ticket", async() => {
            await ticketSystem.createTicket(0, "ANY_MSG", {from: userAddress}).should.be.fulfilled;
            const ticketsCount = await ticketSystem.ticketsCount();
            const ticket = await ticketSystem.tickets(0);
            // ticket properties
            assert.notEqual(ticket[0], 0);
            assert.equal(ticket[1], 0);
            assert.notEqual(ticket[2], 0);
            assert.equal(ticket[3], 1);
            assert.equal(ticket[4], STATE_OPEN);
            assert.equal(ticket[5], userAddress);
            // global properties
            assert.equal(ticketsCount, 1);
        });
    });

    describe("getTicketMessage()", () => {
        it("should revert if message not exists", async() => {
            await ticketSystem.createTicket(0, "ANY_MSG", {from: userAddress}).should.be.fulfilled;
            await ticketSystem.getTicketMessage(0, 1).should.be.rejectedWith("revert");
        });

        it("should return author and ticket message", async() => {
            await ticketSystem.createTicket(0, "ANY_MSG", {from: userAddress}).should.be.fulfilled;
            const msg = await ticketSystem.getTicketMessage(0, 0).should.be.fulfilled;
            assert.equal(msg[0], userAddress);
            assert.equal(msg[1], "ANY_MSG");
        });
    });

    describe("removeAdmin()", () => {
        it("should revert if admin address is 0x00", async() => {
            const invalidAdminAddress = 0x00;
            await ticketSystem.removeAdmin(invalidAdminAddress, {from: ownerAddress}).should.be.rejectedWith("revert");
        });

        it("should remove admin", async() => {
            // add admin
            await ticketSystem.addAdmin(adminAddress, {from: ownerAddress}).should.be.fulfilled;
            assert.equal(await ticketSystem.adminActive(adminAddress), true);
            assert.equal(await ticketSystem.admins(0), adminAddress);
            // remove admin
            await ticketSystem.removeAdmin(adminAddress, {from: ownerAddress}).should.be.fulfilled;
            assert.equal(await ticketSystem.adminActive(adminAddress), false);
            assert.equal(await ticketSystem.admins(0), 0x00);
        });
    });

    describe("replyToTicketByAdmin()", () => {
        it("should reply to ticket by admin", async() => {
            await ticketSystem.addAdmin(adminAddress, {from: ownerAddress}).should.be.fulfilled;
            await ticketSystem.createTicket(0, "ANY_MSG", {from: userAddress}).should.be.fulfilled;
            await ticketSystem.replyToTicketByAdmin(0, "ANY_MSG2", {from: adminAddress}).should.be.fulfilled;
        });
	});
	
	describe("replyToTicketByUser()", () => {
        it("should revert if message sender is not the ticket owner", async() => {
            await ticketSystem.createTicket(0, "ANY_MSG", {from: userAddress}).should.be.fulfilled;
            await ticketSystem.replyToTicketByUser(0, "ANY_MSG2", {from: userAddress2}).should.be.rejectedWith("revert");
		});
		
		it("should reply to ticket by user", async() => {
            await ticketSystem.createTicket(0, "ANY_MSG", {from: userAddress}).should.be.fulfilled;
            await ticketSystem.replyToTicketByUser(0, "ANY_MSG2", {from: userAddress}).should.be.fulfilled;
        });
	});
	
	describe("writeMessageToTicket()", () => {
        it("should revert if author is 0x00", async() => {
			await ticketSystem.createTicket(0, "ANY_MSG", {from: userAddress}).should.be.fulfilled;
			await ticketSystem.writeMessageToTicket(0, 0x00, "ANY_MSG2", {from: userAddress}).should.be.rejectedWith("revert");
		});
		
		it("should write message to ticket", async() => {
			await ticketSystem.createTicket(0, "ANY_MSG", {from: userAddress}).should.be.fulfilled;

			const ticketBefore = await ticketSystem.tickets(0);
			assert.equal(ticketBefore[3], 1);

			await increaseTime(1);
			await ticketSystem.writeMessageToTicket(0, userAddress, "ANY_MSG2", {from: userAddress}).should.be.fulfilled;
			
			const ticketAfter = await ticketSystem.tickets(0);
			assert.equal(ticketAfter[3], 2);
			assert.isTrue(ticketAfter[2] > ticketBefore[2]);

			const msg = await ticketSystem.getTicketMessage(0, 1);
			assert.equal(msg[0], userAddress);
			assert.equal(msg[1], "ANY_MSG2");
        });
	});

});