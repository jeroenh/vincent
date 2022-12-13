import React from 'react';
import {InputGroup, Form, Button} from 'react-bootstrap';

const Searchbar = (props) => {
  return (
      <InputGroup className="w-100">                                                              
          <Form.Control
              placeholder={props.placeholder || "Search"}
              aria-label="Search"
              value={props.value || ""}
              onChange={props.onChange}
          />                                                                                      
          <Button variant="btn btn-outline-secondary" id="button-addon2" type="submit" title="Search">           
              <i className="fas fa-search"></i>                                                   
          </Button>                                                                               
      </InputGroup>
  );
};

export default Searchbar;
