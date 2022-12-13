import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Nav, Dropdown, DropdownButton, InputGroup, CardGroup, Alert, Button, Tab, Tabs, Row, Form, Card, Col } from 'react-bootstrap';
import DisplayLogo from './DisplayLogo';


const MessageThreadHeader = (props) => {


    return (
        props.thread ?
        <>
            <div className="d-flex justify-content-center gap-1">
                {props.thread.users.map((user, index) => (
                    <DisplayLogo
                        name={user.name}
                        photo={user.photo}
                        color={user.logocolor}
                        key={`logo-${index}`}
                    />
                ))}

                {props.thread.groups.map((group, index) => (

                    <DisplayLogo
                        name={group.name}
                        photo={group.photo}
                        color={group.logocolor}
                        key={`glogo-${index}`}
                    />

                ))}

            </div>
            <div className="d-flex justify-content-center mb-3">
                <Dropdown>
                    <Dropdown.Toggle className="p-1 mt-1 chat-dropdown" variant="light" title="View Chat Participants">
                        {props.thread.users.length + props.thread.groups.length > 1 ?
                            <span>{props.thread.users.length + props.thread.groups.length} participants</span>

                            :
                            <>1 participant</>
                        }
                    </Dropdown.Toggle>
                    <Dropdown.Menu>
                        {props.thread.users.map((user, index) => {
                            return (
                                <Dropdown.Item key={`threadusers-${index}`} className="d-flex flex-row gap-2 mb-2 align-items-center">
                                    <DisplayLogo
                                        name={user.name}
                                        photo={user.photo}
                                        color={user.logocolor}
                                    />
                                    <p className="pt-1">{user.name}</p>
                                </Dropdown.Item>
                            )
                        })}
                        <>
                            {props.thread.groups.map((group, index) => {
                                return (
                                    <Dropdown.Item key={`threadgroups-${index}`} className="d-flex flex-row gap-2 mb-2 align-itmes-center">
                                        <DisplayLogo
                                            name={group.name}
                                            photo={group.photo}
                                            color={group.logocolor}
                                        />
                                        <p className="pt-1">{group.name}</p>
                                    </Dropdown.Item>
                                )
                            })}
                        </>
                    </Dropdown.Menu>
                </Dropdown>
            </div>


        </>
        :
        ""

    );

}

export default MessageThreadHeader;