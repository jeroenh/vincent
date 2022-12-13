import React from "react";
import GroupRoutes from "./GroupRoutes";
import { render, fireEvent, waitFor, screen, waitForElementToBeRemoved } from "@testing-library/react";

import SearchGroupsApp from "./SearchGroupsApp";
import UserProvider from './UserProvider.js';
import { MemoryRouter } from "react-router";
import userEvent from "@testing-library/user-event";
import data from "../testUtils/MockCaseInfo.json";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { cleanup } from "@testing-library/react";


const mock = new MockAdapter(axios, { onNoMatch: "throwException" });

describe("Search Groups Component", () => {

    afterEach(() => {
        cleanup;
        mock.reset();
        mock.resetHistory();
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });


    it("should render list of groups and group activity", async () => {


	mock.onGet("http://localhost:8000/cvdp/api/user/").reply(
	    200,
	    data['user']
	);
	mock.onGet("http://localhost:8000/cvdp/api/groups/").reply(
	    200,
	    data['groups']
	);

	mock.onGet("http://localhost:8000/cvdp/api/contact/activity/").reply(
	    200,
	    []
	);

	const group_array = data['groups']['results']
	let groups = group_array.filter((item) => (item['type'] == 'Group'));

	mock.onGet("http://localhost:8000/cvdp/api/groups/?type=Groups").reply(
	    200,
	    {'count': 2, 'results': groups, "pages": 1, "page_size": 20}
	);

	let users = group_array.filter((item) => (item['type'] != 'Group'));

	mock.onGet("http://localhost:8000/cvdp/api/groups/?type=Contacts").reply(
	    200,
	    {'count': 1, 'results': users, "pages": 1, "page_size": 20}
	);

	const user = userEvent.setup();

        const { container } = render(
	    <MemoryRouter initialEntries={["/cvdp/groups"]}>
		<UserProvider>
		    <SearchGroupsApp />
		</UserProvider>
	    </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText(/Contact Search/i)).toBeInTheDocument();
	    expect(screen.getByText(/Crazy Horse/i)).toBeInTheDocument();
	    expect(screen.getByText(/Bright Lights/i)).toBeInTheDocument();
	    expect(screen.getByText(/test@gmail.com/i)).toBeInTheDocument();
	    expect(screen.getByText(/Recent Activity/i)).toBeInTheDocument();
	    expect(screen.getByPlaceholderText("Search Contacts")).toBeInTheDocument();
	    expect(screen.getByRole('link', { name: 'All'})).toBeInTheDocument();
	    expect(screen.getByRole('link', { name: 'Contacts'})).toBeInTheDocument();
	    expect(screen.getByRole('link', { name: 'Groups'})).toBeInTheDocument();
	    expect(screen.getByRole('link', { name: 'Users'})).toBeInTheDocument();
	    user.click(screen.getByRole('link', {name: 'Groups'}));
	});

	await waitForElementToBeRemoved(() => screen.getByText(/test@gmail.com/));

	await waitFor(() => {
	    user.click(screen.getByRole('link', {name: 'Contacts'}));
	});

	await waitForElementToBeRemoved(() => screen.getByText(/Crazy Horse/));

    });

    it("should add new group if prompted", async () => {

	mock.onGet("http://localhost:8000/cvdp/api/user/").reply(
	    200,
	    data['user']
	);
	mock.onGet("http://localhost:8000/cvdp/api/groups/").reply(
            200,
            data['groups']
        );

	mock.onGet("http://localhost:8000/cvdp/groups/new/").reply(
	    200,
	    []
	);

        const user = userEvent.setup();

        const { container } = render(

	    <MemoryRouter initialEntries={["/cvdp/groups"]}>
                <UserProvider>
                    <SearchGroupsApp />
                </UserProvider>
            </MemoryRouter>
        );

        await waitFor(() => {
            const newgroup = container.getElementsByClassName('groupactions');
            user.click(newgroup[0]);
	})

	await waitFor(() => {
            expect(screen.getByText(/Add Group/i)).toBeInTheDocument();
            user.click(screen.getByText(/Add Group/i));
        })

	await waitFor(() => {
	    expect(screen.getByText(/Add New Group/i)).toBeInTheDocument();
	    expect(screen.getByRole("button", {name:/Cancel/i})).toBeInTheDocument();
	    expect(screen.getByRole("button", {name:/Submit/i})).toBeInTheDocument();
	    user.click(screen.getByRole("button", {name:/Cancel/i}));
        })

        await waitForElementToBeRemoved(() => screen.getByText(/Add New Group/));

    });


    it("should navigate to group page if clicked upon", async () => {

	mock.onGet("http://localhost:8000/cvdp/api/user/").reply(
	    200,
	    data['user']
	);

	 mock.onGet("http://localhost:8000/cvdp/api/groups/").reply(
            200,
            data['groups']
        );

	mock.onGet("http://localhost:8000/cvdp/api/group/9e30cddf-7096-4472-9ad5-9141a84a1444/")
	    .reply(
		200,
		data['group']
	    )

        const user = userEvent.setup();

        const { container } = render(
            <MemoryRouter initialEntries={["/cvdp/groups/*", "/cvdp/groups/:id"]}
			  initialIndex={0}
	    >
                <UserProvider>
                    <SearchGroupsApp />
                </UserProvider>
	    </MemoryRouter>
        );

	mock.onGet("http://localhost:8000/cvdp/api/group/9e30cddf-7096-4472-9ad5-9141a84a1444/")
	    .reply(
		200,
		data['group']
            )
	mock.onGet("http://localhost:8000/cvdp/api/groups/24/contacts/?verified=False")
	    .reply(200,
		   []
		  )
	mock.onGet("http://localhost:8000/cvdp/api/groups/24/contacts/?verified=True")
	    .reply(200,
		   []
		  )
	    .onAny()
	    .reply(200, []);
	/*mock.onGet("http://localhost:8000/cvdp/groups/9e30cddf-7096-4472-9ad5-9141a84a1444")
	    .reply(200,
		   data['group']
		  )*/

	await waitFor(() => {
            expect(screen.getByText(/Crazy Horse/i)).toBeInTheDocument();
	    expect(screen.getByRole('link', { name: 'Crazy Horse' })).toHaveAttribute('href', '/9e30cddf-7096-4472-9ad5-9141a84a1444')
	    user.click(screen.getByRole("link", {name:"Crazy Horse"}));
	});

	await waitFor(() => {
	    //expect(screen.getAllByText(/Group Detail/i)).toHaveLength(2);
	    expect(screen.getByText(/Crazy Horse/i)).toBeInTheDocument();
	});

    });

    it("should search for contacts", async () => {

	mock.onGet("http://localhost:8000/cvdp/api/user/").reply(
	    200,
	    data['user']
	);

	mock.onGet("http://localhost:8000/cvdp/api/groups/").reply(
            200,
            data['groups']
        );

	mock.onGet("http://localhost:8000/cvdp/api/groups/?type=All&name=something").reply(
            200,
	    []
        );

	const { container } = render(
            <MemoryRouter initialEntries={["/cvdp/groups"]}>
		<UserProvider>
                    <SearchGroupsApp />
		</UserProvider>
            </MemoryRouter>
        );

	await waitFor(() => {
	    expect(screen.getByText(/Crazy Horse/i)).toBeInTheDocument();
            const inputNode = screen.getByPlaceholderText("Search Contacts");
            fireEvent.change(inputNode, { target: { value: "something" } });
        });

        await waitForElementToBeRemoved(() => screen.getByText(/Crazy Horse/));

    });


});
