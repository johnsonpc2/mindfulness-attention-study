
# Script:      AnalysisScript
# Author:      Pierce C. Johnson
# Created:     20260217
# Description: Description of script.
#
# Shortcuts:
#   alt + shift + k: shortcut guide
#   alt + o:         collapse all sections
#   alt + shift + o: expand all sections
#   ctrl + alt + t:  run code section


# Install/Update Packages -----------------------------------------------------

devtools::install_github(
  repo = "johnsonpc2/pcjtools",
  upgrade = "always",
  force = FALSE
)
devtools::install_github(
  repo = "bcdudek/bcdstats",
  upgrade = "never",
  force = FALSE
)


# Load Packages ---------------------------------------------------------------

pcjtools::load_packages(c("bcdstats", "data.table", "ggplot2",
                          "gtsummary", "pcjtools", "psych"))


# Load Data -------------------------------------------------------------------



# Data Wrangling --------------------------------------------------------------



# Visualize -------------------------------------------------------------------



