import React from "react";
import DashboardList from "./DashboardList";
import DashboardApp from "./DashboardApp";
import { render, fireEvent, waitFor, screen } from "@testing-library/react";

import { MemoryRouter } from "react-router";
import userEvent from "@testing-library/user-event";
import { createMemoryHistory } from "history";
import CaseThreadAPI from "./ThreadAPI";

class ResizeObserver {
  observe() {}
  unobserve() {}
}

//jest.mock("./ThreadAPI");
jest.mock("./ThreadAPI"); // see assets/js/__mocks__/ThreadApi.js"
jest.mock("./TicketAPI");

HTMLCanvasElement.prototype.getContext = jest.fn();
const caseapi = new CaseThreadAPI();
document.execCommand = jest.fn()

window.HTMLElement.prototype.scrollIntoView = jest.fn()

describe("Dashboard Component", () => {

    it("should render alert when API error occurs", async () => {
	window.ResizeObserver = ResizeObserver;
	const { container } = render(
            <MemoryRouter>
                <DashboardList />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole("alert")).toBeInTheDocument();
        });
    });

    it("should show loading dots while loading", async () => {
	window.ResizeObserver = ResizeObserver;
        const { container } = render(
            <MemoryRouter>
                <DashboardList />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(container.getElementsByClassName("lds-spinner").length).toBe(
                2
            );
        });
    });

    it("should render cases when api responds", async () => {
	window.ResizeObserver = ResizeObserver;
        await waitFor(() => {
            render(
                <MemoryRouter>
                    <DashboardList />
                </MemoryRouter>
            );
        });
        await waitFor(() => {
            expect(screen.getAllByRole("textbox")).toHaveLength(2);
            expect(screen.getByText(/CASE#312650/i)).toBeInTheDocument();
            screen.getByText("Recent Activity");
            expect(
                screen.getByText(/added Affected status/)
            ).toBeInTheDocument();
        });
    });

    it("should filter when input is changed - no results", async () => {
	window.ResizeObserver = ResizeObserver;
        const { container } = render(
            <MemoryRouter>
                <DashboardList />
            </MemoryRouter>
        );

        await waitFor(() => {
            const inputNode = screen.getByPlaceholderText("Filter My Active/Pending Cases");
            fireEvent.change(inputNode, { target: { value: "something" } });

            expect(
                screen.getByText(/You have no active cases/)
            ).toBeInTheDocument();
        });
    });

    it("should filter when input is changed - with results", async () => {
	window.ResizeObserver = ResizeObserver;
        const { container } = render(
            <MemoryRouter>
                <DashboardList />
            </MemoryRouter>
        );
        /*mock implementation of filter */
        //let spy = jest.spyOn(caseapi, 'getMyCases')//.mockImplementation(() => Promise.resolve({data: []}));

        await waitFor(() => {
            const inputNode = screen.getByPlaceholderText("Filter My Active/Pending Cases");
            fireEvent.change(inputNode, { target: { value: "Airpods" } });
            console.log("inputNode.value", inputNode.value);
            expect(screen.getByText(/CASE#312650/i)).toBeInTheDocument();
            //expect(container.getElementsByClassName("lds-spinner").length).toBe(1);
        });
    });

    it("should go to case view when clicked", async () => {
	window.ResizeObserver = ResizeObserver;
        const history = createMemoryHistory({
            initialEntries: ["/cvdp/dashboard"],
        });
        history.push = jest.fn();

        render(
            <MemoryRouter
                initialEntries={["/cvdp/dashboard", "/cvdp/cases/:id"]}
                initialIndex={0}
            >
                <DashboardApp />
            </MemoryRouter>
        );
        const user = userEvent.setup();

        await waitFor(() => {
            expect(screen.getByText(/CASE#312650/i)).toBeInTheDocument();
            expect(
                screen.getByRole("link", { name: /^CASE#312650/ })
            ).toBeInTheDocument();
        });
        expect(history.location.pathname).toBe("/cvdp/dashboard");
        await user.click(screen.getByRole("link", { name: /^CASE#312650/ }));
        await waitFor(() => {
            expect(screen.getByText("Original Report")).toBeInTheDocument();

            //expect(window.location.pathname).toBe('/cvdp/cases/312650');
        });

        //expect(routertest.state.location).toBe('/cvdp/cases/312650')
        //.toHaveBeenCalledWith('/cvdp/cases/312650')
    });

    it("should go to case view when activity clicked", async () => {
	window.ResizeObserver = ResizeObserver;
        const history = createMemoryHistory({
            initialEntries: ["/cvdp/dashboard"],
        });
        history.push = jest.fn();
        let assignMock = jest.fn();

        delete window.location;
        window.location = {
            href: "",
        };

        render(
            <MemoryRouter
                initialEntries={["/cvdp/dashboard", "/cvdp/cases/:id"]}
                initialIndex={0}
            >
                <DashboardApp />
            </MemoryRouter>
        );
        const user = userEvent.setup();

        await waitFor(() => {
            expect(screen.getByText(/bing/i)).toBeInTheDocument();
            expect(
                screen.getByRole("button", { name: /bing/ })
            ).toBeInTheDocument();
        });

        expect(history.location.pathname).toBe("/cvdp/dashboard");

        await user.click(screen.getByRole("button", { name: /bing/ }));
        expect(window.location.href).toBe("/cvdp/cases/312650");
        //expect(window.location.pathname).toBe('/cvdp/cases/312650');

        //expect(screen.getByText("Original Report")).toBeInTheDocument();
    });
});
