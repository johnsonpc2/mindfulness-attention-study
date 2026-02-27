
# Script:      AnalysisScript
# Author:      Pierce C. Johnson
# Created:     20260213
# Modified:    20260227
# Description: Analyzes behavioral and survey data from the Mindfulness and
#   Attention Study (Spring 2026). Covers participant exclusions, visual search
#   RT/accuracy, and relationships between survey scores (mindfulness, life
#   satisfaction, conscientiousness) and search performance.
#
# Output:      Plots saved to ./plots; data backed up to GitHub
#
# Shortcuts:
#   alt + shift + k: shortcut guide
#   alt + o:         collapse all sections
#   alt + shift + o: expand all sections
#   ctrl + alt + t:  run code section


# Setup -----------------------------------------------------------------------

# First we need to install useful packages from GitHub
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

# Load all packages used in this script
pcjtools::load_packages(c(
  "bcdstats", "car", "data.table", "emmeans",
  "ggplot2", "gtsummary", "lme4", "pcjtools", "psych"
))

# Pull latest data files from the Pavlovia GitLab repository
git_pull()

# Clear workspace before analysis
clean_workspace(confirm = FALSE)


# Read In Data ----------------------------------------------------------------

# Get list of all raw CSV files in the data folder, then import them
files_info(path = "./data", extension = ".csv") -> data_files
import_data(x = data_files$filepath) -> raw_data


# Clean Data ------------------------------------------------------------------

local({

  # Filter to just demographic trials; keep ID, phase, and response columns
  raw_data[
    phase %like% "demographics",
    list(sona_id, phase, response)
  ] -> demo_temp

  # Exclude subjects for the following reasons (11 total excluded; 17 files):
  demo_temp[!sona_id %in% c(
    78409, 78593, 78958, 79098, # multiple attempts (2, 2, 2, 3)
    79251,                      # no age; multiple attempts (2)
    79283,                      # not English proficient
    78921, 78371, 79106, 78360, 78393  # outlier RT proportion > 2 SDs
  )] -> demo_temp2

  # Reshape to wide format (one row per subject) and coerce age to numeric
  widen_responses(DT = demo_temp2) -> demo_temp3
  demo_temp3[, age := as.numeric(age)]

  # Save the retained subject IDs for use in downstream filtering
  demo_temp3[, sona_id] -> subject_ids

  # Summarize demographics
  gtsummary::tbl_summary(data = demo_temp3, include = "gender") -> gender_table
  gtsummary::tbl_summary(data = demo_temp3, include = "race")   -> race_table
  describe(x = demo_temp3$age, fast = TRUE)                     -> age_stats

  results <- list(
    "demographics"    = demo_temp3,
    "subjects to keep" = subject_ids,
    "gender"          = gender_table,
    "race"            = race_table,
    "age"             = age_stats
  )

}) -> demo_data


# Visual Search Analysis ------------------------------------------------------

local({

  # Build visual search dataset for retained subjects only
  raw_data[
    sona_id %in% demo_data$`subjects to keep` & phase == "visual_search_trial",
    list(sona_id, phase, block, distractor_type, target_present,
         stimuli_list, rt, response, correct)
  ][,
    `:=`(
      rt       = as.numeric(rt),
      block    = block + 1,
      set_size = lengths(strsplit(gsub('\\[|\\]|"', "", stimuli_list), ","))
    )
  ][, stimuli_list := NULL] -> vs_data

  # Flag outlier trials: those falling outside ±2 SDs of the grand mean RT
  grand_mean_rt <- mean(vs_data$rt, na.rm = TRUE)
  grand_sd_rt   <- sd(vs_data$rt,   na.rm = TRUE)

  vs_data[,
          is_outlier := rt > grand_mean_rt + (2 * grand_sd_rt) |
            rt < grand_mean_rt - (2 * grand_sd_rt)
  ]

  # Collapse across blocks: compute mean RT, proportion correct, and outlier
  # flag per condition. A condition is flagged if any of its trials was an outlier.
  vs_data[,
          list(
            prop_correct = mean(correct),
            avg_rt       = mean(rt),
            is_outlier   = any(is_outlier, na.rm = TRUE)
          ),
          by = list(sona_id, distractor_type, target_present, set_size, correct)
  ] -> vs_collapsed

  # Summarize outlier rate per participant; flag anyone exceeding 10%
  vs_data[,
          list(
            n_trials      = .N,
            n_outliers    = sum(is_outlier, na.rm = TRUE),
            prop_outliers = mean(is_outlier, na.rm = TRUE)
          ),
          by = sona_id
  ] -> outlier_summary

  # Summarize accuracy: flag conditions where p(correct) < .80
  vs_collapsed[,
               list(
                 total_conditions  = .N,
                 n_low_accuracy    = sum(prop_correct < 0.80),
                 prop_low_accuracy = mean(prop_correct < 0.80)
               ),
               by = sona_id
  ] -> vs_accuracy

  results <- list(
    "vs_data"         = vs_data,
    "vs_collapsed"    = vs_collapsed,
    "vs_accuracy"     = vs_accuracy,
    "outlier_summary" = outlier_summary,
    "outlier_subjects"    = outlier_summary[prop_outliers > 0.05]
  )

}) -> vs_data

explore(
  x = vs_data$vs_collapsed$avg_rt,
  varname = "Avg RT"
)


# Visual Search Plots -----------------------------------------------------

local({

  # Shared distractor type labels used across both plots
  distractor_labels <- as_labeller(c(
    `blue_triangle` = "Blue Triangle",
    `red_blue_mix`  = "Red/Blue Mix",
    `red_circle`    = "Red Circle"
  ))

  # Accuracy plot: proportion correct by set size, target presence, and
  # distractor type.
  ggplot(
    data    = vs_data$vs_collapsed,
    mapping = aes(
      x     = set_size,
      y     = prop_correct,
      color = factor(target_present, labels = c("Absent", "Present"))
    )
  ) +
    stat_summary(
      fun.data = mean_cl_boot,
      position = position_dodge(width = 0.5)
    ) +
    facet_wrap(~distractor_type, labeller = distractor_labels) +
    scale_x_continuous(breaks = c(3, 6, 9)) +
    scale_y_continuous(limits = c(0, 1)) +
    labs(
      title    = "Accuracy High Across All Conditions:",
      subtitle = "No Set Size or Conjunction Effects",
      y        = "pCorrect",
      x        = "Set Size"
    ) +
    guides(color = guide_legend(title = "Target")) +
    theme_pcj(
      legend.position      = c(0.98, 1.1),
      legend.key.spacing.x = unit(.5, "in")
    ) -> acc_plot

  # RT plot: average RT on correct trials by set size, target presence, and
  # distractor type.
  ggplot(
    data    = vs_data$vs_collapsed[correct == TRUE],
    mapping = aes(
      x     = set_size,
      y     = avg_rt,
      color = factor(target_present, labels = c("Absent", "Present"))
    )
  ) +
    stat_summary(
      fun.data  = mean_cl_boot,
      position  = position_dodge(width = 0.75),
      size      = .75,
      linewidth = .75
    ) +
    facet_wrap(~distractor_type, labeller = distractor_labels) +
    scale_x_continuous(breaks = c(3, 6, 9)) +
    scale_y_continuous(limits = c(0, 3500)) +
    labs(
      title    = "Slow Correct Decisions when Target Absent:",
      subtitle = "Set Size and Conjunction Effects",
      y        = "Average RT (ms)",
      x        = "Set Size"
    ) +
    guides(color = guide_legend(title = "Target")) +
    theme_pcj(
      legend.position      = c(0.98, 1.1),
      legend.key.spacing.x = unit(.5, "in")
    ) -> rt_plot

  plot_results <- list(
    "vs_accuracy" = acc_plot,
    "vs_rt"       = rt_plot
  )

}) -> vs_data$vs_plots

plot_saver(
  plots   = vs_data$vs_plots,
  dir     = "./plots",
  names   = names(vs_data$vs_plots),
  dpi     = 600,
  preview = FALSE,
  width   = 15.5,
  height  = 9
)


# Mixed Effects Models (Exploratory) ------------------------------------------
# NOTE: Not currently run. Kept for reference.

# glmer(
#   rt ~ distractor_type * target_present * set_size +
#     (1 | sona_id),
#   data   = vs_data$vs_data[correct == TRUE],
#   family = Gamma(link = "log")
# ) -> fit
#
# summary(fit)
# Anova(fit, type = 3)
#
# # Main effect of set_size
# emmeans(fit, pairwise ~ set_size, adjust = "bonferroni", type = "response")
#
# # Interaction: set_size within each level of target_present
# emmeans(fit, pairwise ~ set_size | target_present, adjust = "bonferroni", type = "response")
#
# glmer(
#   rt ~ distractor_type * target_present * set_size +
#     (distractor_type + target_present + set_size | sona_id),
#   data   = vs_data$vs_data[correct == TRUE],
#   family = Gamma(link = "log")
# ) -> mid_fit
#
# summary(mid_fit)
# tbl_regression(mid_fit, exponentiate = TRUE)


# Survey Analysis -------------------------------------------------------------

local({

# Extract survey responses for retained subjects; reshape to wide format
raw_data[
  sona_id %in% demo_data$`subjects to keep` & phase %like% "survey",
  list(sona_id, phase, response)
] -> survey_temp

widen_responses(DT = survey_temp, prefix = "phase") -> survey_temp2

# Recode all item columns to numeric and shift from 0–4 to 1–5 scale
recode_cols(dt = survey_temp2, cols = 2:65, class = "numeric") -> survey_temp3

melt(
  data          = survey_temp3,
  id.vars       = "sona_id",
  variable.name = "Measure",
  value.name    = "item_score"
) -> survey_temp4

survey_temp4[, item_score := item_score + 1]

# Define Conscientiousness items and which are reverse-coded
conscientiousness_items <- c(
  "big5_survey_Thorough",
  "big5_survey_Careless",
  "big5_survey_Reliable",
  "big5_survey_Disorganzied",
  "big5_survey_Lazy",
  "big5_survey_perservere",
  "big5_survey_Efficient",
  "big5_survey_plans",
  "big5_survey_distracted"
)

reverse_items <- c(
  "big5_survey_Careless",
  "big5_survey_Disorganzied",
  "big5_survey_Lazy",
  "big5_survey_distracted"
)

# Reverse-score negatively-worded items (6 - score on a 1–5 scale)
survey_temp4[
  Measure %in% reverse_items,
  item_score_recoded := 6 - item_score
][
  !(Measure %in% reverse_items),
  item_score_recoded := item_score
]

# Compute subscale scores:
#   Mindfulness:        mean of items
#   Life Satisfaction:  sum of items
#   Conscientiousness:  sum of all items, with negatively-worded items
#                       reverse-scored prior to summing
survey_temp4[
  Measure %like% "mindfulness",
  score := mean(item_score, na.rm = TRUE),
  by = "sona_id"
][
  Measure %like% "satisfaction",
  score := sum(item_score, na.rm = TRUE),
  by = "sona_id"
][
  Measure %in% conscientiousness_items,
  score := sum(item_score_recoded, na.rm = TRUE),
  by = "sona_id"
] -> survey_temp5

# Extract one score per person per subscale and combine into a single table
list(
  survey_temp5[Measure %like% "mindfulness",
               .(Measure = "mindfulness",      score = unique(score)), by = "sona_id"],
  survey_temp5[Measure %like% "satisfaction",
               .(Measure = "satisfaction",     score = unique(score)), by = "sona_id"],
  survey_temp5[Measure %in% conscientiousness_items,
               .(Measure = "conscientiousness", score = unique(score)), by = "sona_id"]
) |> rbindlist() -> survey_scores

# Reshape to wide format: one row per subject with a column per subscale
dcast(
  data      = survey_scores,
  formula   = sona_id ~ Measure,
  value.var = "score"
)

}) -> survey_data


# Combined Dataset ------------------------------------------------------------

# Merge visual search and survey data on subject ID
merge(
  x     = vs_data$vs_collapsed,
  y     = survey_data,
  by    = "sona_id",
  all.x = TRUE
) -> vs_data$full_data

# Survey × RT Plots -----------------------------------------------------------

local({

  # Helper: build a faceted scatterplot of avg RT by a given survey score.
  # Faceted by distractor type; color indicates target presence.
  make_survey_rt_plot <- function(data, x_var, x_label) {
    ggplot(
      data    = data[!is.na(get(x_var))],
      mapping = aes(
        x     = get(x_var),
        y     = avg_rt,
        color = factor(target_present, labels = c("Absent", "Present"))
      )
    ) +
      geom_point(alpha = 0.5, size = 2) +
      geom_smooth(method = "lm", se = TRUE) +
      facet_wrap(
        ~distractor_type,
        labeller = as_labeller(c(
          `blue_triangle` = "Blue Triangle",
          `red_blue_mix`  = "Red/Blue Mix",
          `red_circle`    = "Red Circle"
        ))
      ) +
      scale_y_continuous(limits = c(0, 3500)) +
      labs(
        title    = paste("Response Time by", x_label),
        subtitle = paste("Relationship between", x_label, "and visual search RT"),
        y        = "Average RT (ms)",
        x        = x_label
      ) +
      guides(color = guide_legend(title = "Target")) +
      theme_pcj(
        legend.position      = c(0.98, 1.1),
        legend.key.spacing.x = unit(.5, "in")
      )
  }

  # Simple mindfulness ~ RT scatterplot (no faceting)
  ggplot(
    data    = vs_data$full_data[!is.na(mindfulness)],
    mapping = aes(x = mindfulness, y = avg_rt)
  ) +
    geom_point(alpha = 0.5, size = 2) +
    geom_smooth(method = "lm", se = TRUE) +
    scale_y_continuous(limits = c(0, 3500)) +
    labs(
      title    = "Response Time by Mindfulness Score",
      subtitle = "Relationship between mindfulness and visual search RT",
      y        = "Average RT (ms)",
      x        = "Mindfulness Score"
    ) +
    theme_pcj(
      legend.position      = c(0.98, 1.1),
      legend.key.spacing.x = unit(.5, "in")
    ) -> mindfulness_rt_plot

  # Mindfulness ~ RT broken out by set size, target presence, and distractor type
  ggplot(
    data    = vs_data$full_data[!is.na(mindfulness)],
    mapping = aes(
      x     = mindfulness,
      y     = avg_rt,
      color = factor(set_size, labels = c("3", "6", "9"))
    )
  ) +
    geom_point(alpha = 0.5, size = 2) +
    geom_smooth(method = "lm", se = TRUE) +
    facet_grid(target_present ~ distractor_type) +
    scale_y_continuous(limits = c(0, 3500)) +
    labs(
      title    = "Response Time by Mindfulness Score",
      subtitle = "Broken out by set size, target presence, and distractor type",
      y        = "Average RT (ms)",
      x        = "Mindfulness Score"
    ) +
    guides(color = guide_legend(title = "Set Size")) +
    theme_pcj(
      legend.position      = c(0.98, 1.1),
      legend.key.spacing.x = unit(.5, "in")
    ) -> mindfulness_rt_by_condition_plot

  # Survey score ~ RT plots (faceted, using shared helper)
  satisfaction_rt_plot      <- make_survey_rt_plot(vs_data$full_data, "satisfaction",      "Life Satisfaction Score")
  conscientiousness_rt_plot <- make_survey_rt_plot(vs_data$full_data, "conscientiousness", "Conscientiousness Score")

  # Relationships between survey subscales
  ggplot(vs_data$full_data, aes(x = mindfulness, y = satisfaction)) +
    geom_point() +
    geom_smooth(method = "lm", se = TRUE) -> mind_sat_plot

  ggplot(vs_data$full_data, aes(x = mindfulness, y = conscientiousness)) +
    geom_point() +
    geom_smooth(method = "lm", se = TRUE) -> mind_con_plot

  plot_results <- list(
    "mindfulness_rt"                = mindfulness_rt_plot,
    "mindfulness_rt_by_condition"   = mindfulness_rt_by_condition_plot,
    "satisfaction_rt"               = satisfaction_rt_plot,
    "conscientiousness_rt"          = conscientiousness_rt_plot,
    "mindfulness_satisfaction"      = mind_sat_plot,
    "mindfulness_conscientiousness" = mind_con_plot
  )

}) -> vs_data$survey_rt_plots


# Backup to GitHub ------------------------------------------------------------

git_push(push = TRUE)
