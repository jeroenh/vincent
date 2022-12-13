import React from "react";
import {Link} from "react-router";
import {
    Dropdown,
    DropdownButton,
} from "react-bootstrap";


const ContactManageDropdown = (props) => {

    const loc = props.home ? "" : "../"


    return (
	<DropdownButton
            variant="primary"
            title={
                <span>
                    Manage{" "}
                    <i className="fas fa-chevron-down"></i>
                </span>
            }
        >
	    {props.home ?
	     
	    <Dropdown.Item
                eventKey="unverified"
		as={Link}
                to={`unverified`}
            >
                Unverified
            </Dropdown.Item>

	     :

	     <Dropdown.Item
                eventKey="search"
                as={Link}
                to={loc}
	     >
		 Search
             </Dropdown.Item>
	    }
	     
            {/*<Dropdown.Item
                eventKey="insights"
                as={Link}
                to={`${loc}insights`}
	    >
                Insights
            </Dropdown.Item>
	    <Dropdown.Item
                eventKey="tools"
                as={Link}
                to={`${loc}tools`}
            >
                CPE Tools
            </Dropdown.Item>
	    <Dropdown.Item
		eventKey="predisclosure"
		as={Link}
		to={`${loc}predisclosure`}
            >
		Predisclosure
		</Dropdown.Item>*/}

        </DropdownButton>
    )
}

export default ContactManageDropdown;
