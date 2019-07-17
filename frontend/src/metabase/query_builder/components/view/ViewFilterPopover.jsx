/* @flow */

import React, { Component } from "react";

import DimensionList from "../DimensionList";

import FilterPopoverHeader from "../filters/FilterPopoverHeader";
import FilterPopoverPicker from "../filters/FilterPopoverPicker";
import FilterPopoverFooter from "../filters/FilterPopoverFooter";

import StructuredQuery from "metabase-lib/lib/queries/StructuredQuery";
import type { FieldFilter, ConcreteField } from "metabase/meta/types/Query";

import Filter from "metabase-lib/lib/queries/structured/Filter";

type Props = {
  query: StructuredQuery,
  filter?: Filter,
  onChangeFilter: (filter: Filter) => void,
  onClose: () => void,
};

type State = {
  filter: ?Filter,
};

// NOTE: this is duplicated from FilterPopover but allows you to add filters on
// the last two "stages" of a nested query, e.x. post aggregation filtering
export default class ViewFilterPopover extends Component {
  props: Props;
  state: State;

  constructor(props: Props) {
    super(props);
    this.state = {
      filter: props.filter instanceof Filter ? props.filter : null,
    };
  }

  componentWillMount() {
    window.addEventListener("keydown", this.handleCommitOnEnter);
  }

  componentWillUnmount() {
    window.removeEventListener("keydown", this.handleCommitOnEnter);
  }

  componentWillReceiveProps(nextProps) {
    const { filter } = this.state;
    // HACK?: if the underlying query changes (e.x. additional metadata is loaded) update the filter's query
    if (filter && this.props.query !== nextProps.query) {
      this.setState({
        filter: filter.setQuery(nextProps.query),
      });
    }
  }

  handleCommit = () => {
    this.handleCommitFilter(this.state.filter, this.props.query);
  };

  handleCommitOnEnter = (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      this.handleCommitFilter(this.state.filter, this.props.query);
    }
  };

  handleCommitFilter = (filter: ?FieldFilter, query: StructuredQuery) => {
    if (filter && !(filter instanceof Filter)) {
      filter = new Filter(filter, null, query);
    }
    if (filter && filter.isValid()) {
      this.props.onChangeFilter(filter);
      if (this.props.onClose) {
        this.props.onClose();
      }
    }
  };

  handleFieldChange = (fieldRef: ConcreteField, query: StructuredQuery) => {
    const filter = this.state.filter || new Filter([], null, query);
    this.setState({
      filter: filter.setDimension(fieldRef, { useDefaultOperator: true }),
    });
  };

  handleFilterChange = (newFilter: FieldFilter) => {
    this.setState({ filter: this.state.filter.set(newFilter) });
  };

  handleClearField = () => {
    this.setState({ filter: this.state.filter.setDimension(null) });
  };

  render() {
    const { className, style, query, width = 410, maxHeight } = this.props;
    const { filter } = this.state;

    const dimension = filter && filter.dimension();
    if (!dimension) {
      return (
        <div className={className} style={style}>
          <DimensionList
            className="text-purple"
            width={width}
            maxHeight={maxHeight}
            dimension={dimension}
            sections={query.topLevelFilterFieldOptionSections()}
            onChangeDimension={dimension =>
              this.handleFieldChange(dimension.mbql(), dimension.query())
            }
            onChange={item => {
              this.handleCommitFilter(item.filter, item.query);
            }}
            alwaysExpanded
          />
        </div>
      );
    } else {
      return (
        <div className={className} style={style}>
          <FilterPopoverHeader
            className="px3"
            filter={filter}
            onFilterChange={this.handleFilterChange}
            onClearField={this.handleClearField}
            showFieldPicker
          />
          <div className="px3 mt1">
            <FilterPopoverPicker
              filter={filter}
              onFilterChange={this.handleFilterChange}
              width={null}
            />
          </div>
          <FilterPopoverFooter
            className="p1"
            filter={filter}
            onFilterChange={this.handleFilterChange}
            onCommit={this.handleCommit}
          />
        </div>
      );
    }
  }
}
