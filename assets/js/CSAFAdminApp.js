import React, { useState, useEffect, useCallback } from "react";
import { format, formatDistance } from "date-fns";
import CSAFProfiles from "./CSAFProfiles";
import { useParams, useNavigate, Link, useLocation } from "react-router";
import {
    Nav,
    Tab,
    Card,
} from "react-bootstrap";

const CSAFAdminApp = () => {
    const { id } = useParams();
    const [activeTab, setActiveTab] = useState(id || "profiles");

    const setActiveTabNow = (props) => {
        window.history.pushState({}, '', `${props}`);
        setActiveTab(props);
    }

    return (
	<>
	    <h4 className="fw-bold py-3 mb-4"><span className="text-muted fw-light">Settings /</span> CSAF Settings</h4>

	    <Tab.Container
		defaultActiveKey={activeTab}
		activeKey={activeTab}
		className="mb-3"
		onSelect={setActiveTabNow}
            >
		<Nav variant="pills" className="mb-3">
                    <Nav.Item>
			<Nav.Link tabIndex="0" eventKey="profiles">CSAF Profiles</Nav.Link>
                    </Nav.Item>
                    {/*<Nav.Item>
			<Nav.Link tabindex="0" eventKey="templates">CSAF Templates</Nav.Link>
			</Nav.Item>*/}
		</Nav>
		
		<Tab.Content id="admin-fns" className="p-0">
                    <Tab.Pane eventKey="profiles" key="profiles">
			<CSAFProfiles />
                    </Tab.Pane>
                    <Tab.Pane eventKey="templates" key="templates">
			<Card><Card.Body><p className="lead">Coming soon..</p></Card.Body></Card>
		    </Tab.Pane>
		</Tab.Content>
            </Tab.Container>
	    
	</>
    );
};

export default CSAFAdminApp;
