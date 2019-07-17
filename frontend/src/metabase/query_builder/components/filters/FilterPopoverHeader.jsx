import React from "react";
import cx from "classnames";

import OperatorSelector from "../filters/OperatorSelector";
import { formatField, singularize } from "metabase/lib/formatting";
import Icon from "metabase/components/Icon";

export default function FilterPopoverHeader({
  className,
  showFieldPicker,
  filter,
  onFilterChange,
  onClearField,
}) {
  const dimension = filter.dimension();
  const field = dimension.field();
  const tableDisplayName = field.table && field.table.displayName();

  const showOperatorSelector = !(field.isTime() || field.isDate());
  const showHeader = showFieldPicker || showOperatorSelector;

  const setOperator = operatorName => {
    if (filter.operator() !== operatorName) {
      onFilterChange(filter.setOperator(operatorName));
    }
  };

  return showHeader ? (
    <div className={cx(className, "text-medium")}>
      {showFieldPicker && (
        <div className="flex flex-wrap py1">
          <span
            className="cursor-pointer text-purple-hover transition-color flex align-center"
            onClick={onClearField}
          >
            <Icon name="chevronleft" size={14} />
            {tableDisplayName && (
              <h3 className="ml1 text-wrap">{singularize(tableDisplayName)}</h3>
            )}
          </span>
          {tableDisplayName && <h3 className="ml1">-</h3>}
          <h3 className="ml1 text-default text-wrap">{formatField(field)}</h3>
        </div>
      )}
      {showOperatorSelector && (
        <OperatorSelector
          operator={filter.operatorName()}
          operators={filter.operatorOptions()}
          onOperatorChange={setOperator}
        />
      )}
    </div>
  ) : null;
}
