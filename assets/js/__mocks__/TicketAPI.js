import MockPromise from "../../testUtils/MockPromise";
import data from "../../testUtils/MockCaseInfo.json";



const mock = jest.fn().mockImplementation(() => {

    return {
	getUserAssignments: () => {
	    return Promise.resolve(data['users']);
	},

	getTickets: () => {
	    return Promise.resolve({
		results: []
	    })
	},
	getMyTickets: () => {
	    return Promise.resolve({
		results: []
	    })
	}
    }
});

export default mock;
