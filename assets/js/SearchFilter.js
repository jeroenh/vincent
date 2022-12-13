import React from 'react';
import {InputGroup, Row, Col, Form, Button, DropdownButton, Dropdown} from 'react-bootstrap';

const SearchFilter = ({ onChange, value, owner, status, teams, searchOwners, searchStatus }) => {

  return (
      <InputGroup className="w-100">
          <Form.Control
              placeholder="Search Cases"
              aria-label="Search Cases"
              onChange={(e)=>onChange(e, "search")}
          />
          <Button variant="btn btn-outline-secondary" title="search cases" id="button-addon2" type="submit">
              <i className="fas fa-search" title="search"></i>
          </Button>

	  <DropdownButton
              variant="outline-secondary"
              title="Filter"
	      drop={"down-centered"}
              id="input-group-dropdown-3"
          >
	      <div className="extended-search px-2 py-2">
                  <Row>
		      {owner.length > 0 &&
		       <Col lg={6}>

			   <Form.Label className="px-3">Owner</Form.Label>
			   <Dropdown.ItemText key="all">
			       <Form.Check
				   onChange={(e)=>onChange(e, "owner")}
				   label="All"
				   value="All"
				   title="All"
				   data-testid={`check-all`}
				   type="checkbox"
				   checked= {searchOwners.includes("All")}
			       />
			   </Dropdown.ItemText>
			   <Dropdown.ItemText key="unassigned">
			       <Form.Check
				   onChange={(e)=>onChange(e, "owner")}
				   label="Unassigned"
				   value={0}
				   title="Unassigned"
				   data-testid={`check-unassigned`}
				   type="checkbox"
				   checked= {searchOwners.includes("0") || searchOwners.includes("All")}
			       />
			   </Dropdown.ItemText>
			   {owner.map((o, index) => {
			       return (
				   <Dropdown.ItemText key={index}>
				       <Form.Check
					   onChange={(e)=>onChange(e, "owner")}
					   label={o.name}
					   value={o.uuid}
					   title={o.name}
					   data-testid={`check-${o.name}`}
					   type="checkbox"
					   checked= {searchOwners.includes(o.uuid.toString()) || searchOwners.includes("All")}
				       />
				   </Dropdown.ItemText>
			       )
			   })}
		       </Col>
		      }
		      <Col lg={6}>
			  {teams.length > 1 &&
			   <>
			       <Form.Label className="px-3">Teams</Form.Label>
                               {teams.map((o, index) => {
				   return (
                                       <Dropdown.ItemText key={index}>
					   <Form.Check
                                               onChange={(e)=>onChange(e, "owner")}
                                               label={o.name}
                                               value={o.uuid}
                                               data-testid={`check-${o.name}`}
                                               title={o.name}
                                               type="checkbox"
                                               checked={searchOwners.includes(o.uuid.toString())}
					   />
                                       </Dropdown.ItemText>

				   )
                               })}
			       <Dropdown.Divider />
			   </>
			  }
			  <Form.Label className="px-3">Status</Form.Label>                                                                                                                               {status.map((o, index) => {
			      return (
				  <Dropdown.ItemText key={index}>
				      <Form.Check
					  onChange={(e)=>onChange(e, "status")}
					  label={o.name}
					  value={o.id}
					  data-testid={`check-${o.name}`}
					  title={o.name}
					  type="checkbox"
					  checked={searchStatus.includes(o.id.toString())}
				      />
				  </Dropdown.ItemText>

			      )
			  })}
		      </Col>
		  </Row>
	      </div>
	      </DropdownButton>
      </InputGroup>
  );
};

export default SearchFilter;
