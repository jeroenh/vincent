import React, { useState, useEffect } from 'react';
import {Dropdown, Form, DropdownButton} from 'react-bootstrap';
import DisplayLogo from './DisplayLogo';



const CustomMenu = React.forwardRef(
    ({ children, style, className, 'aria-labelledby': labeledBy }, ref) => {
        const [value, setValue] = useState('');
        return (
            <div
                ref={ref}
                style={style}
                className={className}
                aria-labelledby={labeledBy}
            >
		{React.Children.toArray(children).length > 0 &&
                 <Form.Control
                     autoFocus
                     className="mx-3 my-2 w-auto"
                     placeholder="Type to filter..."
                     onChange={(e) => setValue(e.target.value)}
                     value={value}
                 />
                }

                <ul className="list-unstyled">
                    {React.Children.toArray(children).filter(
                        (child) =>
                        !value || child.props.children.key.toLowerCase().startsWith(value),
                    )}
                </ul>
            </div>
        );
    },
);


const DisplayAssignedTo = ({owners}) => {
    
    if (owners.length > 0) {
	return (
	    <>
		{owners.map((item, index) => {
		    return (
			<div className="d-flex align-items-center gap-2 mt-2 mb-2" key={`owner=${item.uuid}`}>
			    <DisplayLogo
				name={item.name}
				color={item.logocolor}
				photo={item.photo}
			    />
			    <span className="participant">
				{item.name}
			    </span>
			</div>
		    )
		})}
	    </>
	)
    }
    else {
	return (
	    <div className="d-flex align-items-center gap-2 mt-2 mb-2">
		<DisplayLogo
		    name="?"
		/>
		<span className="participant">
		    Unassigned
		</span>
	    </div>
	)
    }
}

const AssignmentDropdownButton = (props) => {


    const [options, setOptions] = useState([]);
    const [owners, setOwners] = useState([]);

    const popperConfig = {
        strategy: "fixed"
    };

    useEffect(() => {
	if (props.options) {
	    setOptions(props.options);
	}

    }, [props.options]);

    useEffect(() => {
	if (props.owners != owners) {
	    setOwners(props.owners);
	}
    }, [props.owners]);

    return (
        <Dropdown onSelect={props.assignUser} className="assignment_dropdown">

	    {props.disabled ?
	     <Dropdown.Toggle className="p-0" variant="light" disabled>
		 <div className="d-flex align-items-center gap-2 mt-2 mb-2">
		     <DisplayAssignedTo
			 owners = {props.owners}
		     />
                 </div>
	     </Dropdown.Toggle>
	     :
             <Dropdown.Toggle className="p-0" variant="light">
		 <DisplayAssignedTo
		     owners={props.owners}
		 />
             </Dropdown.Toggle>
	    }
            <Dropdown.Menu style={{ margin:0}} as={CustomMenu} popperConfig={popperConfig} renderOnMount>

		{options.length > 0 ?
                 options.map((u, index) => {
                     return (
                         <Dropdown.Item key={u.uuid} eventKey={u.uuid}>
                             <div className="d-flex align-items-center gap-2 mt-2 mb-2" key={u.name}>
                                 <DisplayLogo
                                     name={u.name}
                                     color={u.logocolor}
                                     photo={u.photo}
                                 />
                                 <span className="participant">
                                     {u.name}
                                 </span>
                             </div>
                         </Dropdown.Item>
                     )
                 })
                 :""
                }

		{props.auto_assign &&

		<Dropdown.Item key="Auto Assign" eventKey={0}>
                    <div className="d-flex align-items-center gap-2 mt-2 mb-2" key="Auto Assign">
                        <DisplayLogo
                            name="?"
                        />
                        <span className="participant">
                            Auto Assign
                        </span>
                    </div>
                </Dropdown.Item>

		}
		{owners.length > 0 &&
                 <Dropdown.Item key="Unassign" eventKey={-1}>
                     <div className="d-flex align-items-center gap-2 mt-2 mb-2" key="Unassign">
                         <DisplayLogo
                             name="?"
                         />
                         <span className="participant">
                             Unassign
                         </span>
                     </div>
                 </Dropdown.Item>
                }
            </Dropdown.Menu>
        </Dropdown>
    )
}


export default AssignmentDropdownButton;
