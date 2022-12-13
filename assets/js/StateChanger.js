import React from "react";
import { Dropdown } from "react-bootstrap";
import DisplayState from './DisplayState';

const StateChanger = (props) => {

    return (
        <Dropdown onSelect={props.changeState}>
            <Dropdown.Toggle className="p-0" variant="light">
                <DisplayState state={props.state} states={props.states}/>
            </Dropdown.Toggle>
            <Dropdown.Menu>
                {props.states?.map((state, index) => (
                <Dropdown.Item key={ state.name } eventKey={ state.name }>
                    <DisplayState state={ state.name } states={props.states}/>
                </Dropdown.Item>
                ))}
            </Dropdown.Menu>
        </Dropdown>
    );
};

export default StateChanger;
