# Script:      AnalysisScript
# Author:      Pierce C. Johnson
# Created:     20260213
# Modified:    20261105
# Description: Mindfulness and Attention Study (Spring 2026). Participant
#   exclusions, visual search RT/accuracy, and relationships between survey
#   scores (mindfulness, life satisfaction, conscientiousness) and search
#   performance.
#
# Output:      Plots saved to ./plots; data backed up to GitHub
#
# Shortcuts:
#   alt + shift + k:  shortcut guide
#   alt + o:          collapse all sections
#   alt + shift + o:  expand all sections
#   ctrl + alt + t:   run code section
#   ctrl + alt + b:   run all code until the currently selected line


# 1. Setup ---------------------------------------------------------------------

# One-time install of lab packages (uncomment to update)
# devtools::install_github(c("johnsonpc2/pcjtools", "bcdudek/bcdstats"))

pcjtools::load_packages(

  x = c("bcdstats", "car", "data.table", "emmeans", "ggplot2", "ggtext",
        "gtsummary", "lme4", "pcjtools", "psych")

)


# Data frozen for the manuscript (collection ended 2026-05-04)
# git_pull(sleep = 5)

clean_workspace(confirm = FALSE)


paths <- list(

  raw   = "./data",  # Raw Pavlovia CSV files
  plots = "./plots"  # Saved figures

)


## Exclusions ##

# Hardcoded exclusions: 9 subjects; 16 files
# RT exclusions are computed from the rule below (section 3)
exclude_ids <- c(

  75815, 78593, 78958, 79098, 79221,  # Multiple attempts (2,2,2,3,2)
  79251,                              # No age; multiple attempts (2)
  78848, 79283, 79085                 # Not English proficient (3)

)


outlier_cap     <- 5000 # ms; slower trials are outliers (< 200 ms not recorded)
outlier_limit   <- 0.05 # Exclude subjects with more outlier trials than this
n_rows_expected <- 295  # Rows in one complete session


## Survey items ##

consc_items <- c(

  "big5_survey_Thorough", "big5_survey_Careless", "big5_survey_Reliable",
  "big5_survey_Disorganzied", "big5_survey_Lazy", "big5_survey_perservere",
  "big5_survey_Efficient", "big5_survey_plans", "big5_survey_distracted"

)


consc_reverse <- c(

  "big5_survey_Careless", "big5_survey_Disorganzied",
  "big5_survey_Lazy", "big5_survey_distracted"

)


## Labels ##

distractor_labs <- as_labeller(c(

  blue_triangle = "Blue Triangle",
  red_blue_mix  = "Red/Blue Mix",
  red_circle    = "Red Circle"

))


target_labs <- c("Absent", "Present") # target_present FALSE, TRUE


## Helper functions ##

# "*r*(df) = .xx, *p* = .xxx" from a cor.test result
cor_label <- function(ct) {

  paste0(

    "*r*(", ct$parameter, ") ", format_r(ct$estimate),
    ", *p* ", format_p(ct$p.value)

  )

}


# Drop the leading "= " that format_r() adds (used inside CIs)
strip_eq <- function(x) sub("^\\s*=\\s*", "", x)


# Full subtitle: r, p, and 95% CI
cor_subtitle <- function(ct) {

  paste0(

    cor_label(ct),
    ", 95% CI [", strip_eq(format_r(ct$conf.int[1])),
    ", ", strip_eq(format_r(ct$conf.int[2])), "]"

  )

}


# Correlation text box in the top-left corner of each facet
cor_text_layer <- function(labels) {

  ggtext::geom_richtext(

    data        = labels,
    mapping     = aes(x = -Inf, y = Inf, label = label),
    hjust       = -0.05,
    vjust       = 1.1,
    size        = 3.5,
    fill        = "white",
    label.color = NA,
    inherit.aes = FALSE

  )

}


# Theme for faceted condition plots (legend top right)
theme_facets <- theme_pcj(

  legend.position      = c(0.98, 1.1),
  legend.key.spacing.x = unit(0.5, "in"),
  default_caption      = FALSE

)


# 2. Load Data -----------------------------------------------------------------

data <- list()


data_files <- files_info(path = paths$raw, extension = ".csv")

data$raw <- import_data(x = data_files$filepath)


# 3. Demographics & Exclusions -------------------------------------------------

## RT exclusions (computed from the rule, not hardcoded) ##

rt_excl <- data$raw[

  !sona_id %in% exclude_ids & phase == "visual_search_trial",
  list(prop = mean(as.numeric(rt) > outlier_cap, na.rm = TRUE)),
  by = sona_id

][prop > outlier_limit, sona_id]


exclude_ids <- c(exclude_ids, rt_excl)


## Demographics for retained subjects ##

data$demo <- local({

  demo <- data$raw[

    phase %like% "demographics" & !sona_id %in% exclude_ids,
    list(sona_id, phase, response)

  ]


  kept <- unique(demo$sona_id)


  # Stop if new data adds cases the exclusion list doesn't cover
  stopifnot(

    "Retained subject has multiple sessions" =
      data$raw[sona_id %in% kept & trial_index == 0,
               .N, by = sona_id][, all(N == 1)],

    "Retained subject has an incomplete or extra session" =
      data$raw[sona_id %in% kept,
               .N, by = sona_id][, all(N == n_rows_expected)],

    "Retained subject saw the English-fluency exit screen" =
      !any(grepl("fluent in English",
                 data$raw[sona_id %in% kept, stimulus]))

  )


  wide <- widen_responses(DT = demo)           # One row per subject

  wide[, age := as.numeric(age)]


  list(

    table  = wide,
    ids    = wide$sona_id,
    gender = tbl_summary(data = wide, include = "gender"),
    race   = tbl_summary(data = wide, include = "race"),
    age    = describe(x = wide$age, fast = TRUE)

  )

})


# 4. Visual Search -------------------------------------------------------------

data$vs <- local({

  trials <- data$raw[

    sona_id %in% data$demo$ids & phase == "visual_search_trial",
    list(sona_id, block, distractor_type, target_present,
         stimuli_list, rt, response, correct)

  ][

    , `:=`(

      rt       = as.numeric(rt),
      block    = block + 1,
      set_size = lengths(strsplit(gsub('\\[|\\]|"', "", stimuli_list), ",")),
      response = tolower(response)

    )

  ][, stimuli_list := NULL]


  ## Outlier trials: RT > 5000 ms (responses < 200 ms not recorded by task) ##

  trials[, is_outlier := rt > outlier_cap]


  outliers <- trials[

    , list(

      n_trials      = .N,
      n_outliers    = sum(is_outlier, na.rm = TRUE),
      prop_outliers = mean(is_outlier, na.rm = TRUE)

    ),
    by = sona_id

  ]


  if (nrow(outliers[prop_outliers > outlier_limit])) {

    warning("Retained subjects over the outlier limit: ",
            toString(outliers[prop_outliers > outlier_limit, sona_id]))

  }


  clean   <- trials[is_outlier == FALSE]       # Clean trials only
  cell_by <- c("sona_id", "distractor_type", "target_present", "set_size")


  ## Collapse across blocks: one row per subject x condition ##

  # Accuracy uses all clean trials; RT uses correct clean trials
  acc_cells <- clean[, list(prop_correct = mean(correct)), by = cell_by]

  rt_cells  <- clean[correct == TRUE, list(avg_rt = mean(rt)), by = cell_by]


  low_acc <- acc_cells[

    , list(

      n_cells  = .N,
      n_low    = sum(prop_correct < 0.80),
      prop_low = mean(prop_correct < 0.80)

    ),
    by = sona_id

  ]


  list(

    trials    = trials,
    outliers  = outliers,
    acc_cells = acc_cells,
    rt_cells  = rt_cells,
    low_acc   = low_acc,
    rt_stats  = list(m = mean(rt_cells$avg_rt), sd = sd(rt_cells$avg_rt))

  )

})


# 5. Survey Scores -------------------------------------------------------------

data$scores <- local({

  items <- data$raw[

    sona_id %in% data$demo$ids & phase %like% "survey",
    list(sona_id, phase, response)

  ]


  wide <- widen_responses(DT = items, prefix = "phase")

  wide <- recode_cols(dt = wide, cols = 2:65, class = "numeric")


  long <- melt(

    wide,
    id.vars       = "sona_id",
    variable.name = "measure",
    value.name    = "item_score"

  )


  long[, item_score := item_score + 1]         # Index 0 -> 1


  # Score so higher = more of the construct (first on-screen label = 1)
  long[, item_scored := fcase(

    measure %like% "mindfulness", item_score,      # 6 = Almost never (MAAS)
    measure %like% "satisfaction", 8 - item_score, # 7 = Strongly agree
    measure %in% consc_reverse, item_score,        # Reverse-keyed: as is
    measure %like% "big5", 6 - item_score          # 5 = Agree strongly

  )]


  # Mindfulness:       mean of items (1-6); higher = more mindful
  # Life satisfaction: sum of items (5-35); 20-24 = neutral
  # Conscientiousness: mean of items (1-5); higher = more conscientious
  scores <- rbindlist(list(

    long[measure %like% "mindfulness",
         list(scale = "mindfulness",
              score = mean(item_scored, na.rm = TRUE)), by = sona_id],

    long[measure %like% "satisfaction",
         list(scale = "satisfaction",
              score = sum(item_scored, na.rm = TRUE)), by = sona_id],

    long[measure %in% consc_items,
         list(scale = "conscientiousness",
              score = mean(item_scored, na.rm = TRUE)), by = sona_id]

  ))


  dcast(scores, sona_id ~ scale, value.var = "score")

})


# 6. Combined Data -------------------------------------------------------------

# One row per subject x distractor x target (RT averaged over set size)
data$cond <- merge(

  data$vs$rt_cells[

    , list(avg_rt = mean(avg_rt, na.rm = TRUE)),
    by = list(sona_id, distractor_type, target_present)

  ],
  data$scores,
  by    = "sona_id",
  all.x = TRUE

)


# Per-subject search efficiency: RT slope across set size (ms/item)
data$slopes <- merge(

  data$vs$rt_cells[

    , list(slope = coef(lm(avg_rt ~ set_size))[["set_size"]]),
    by = list(sona_id, distractor_type)

  ],
  data$scores[, list(sona_id, mindfulness, conscientiousness)],
  by    = "sona_id",
  all.x = TRUE

)


# 7. Models --------------------------------------------------------------------

models <- list()


# Sum-to-zero contrasts so Type III main effects average over other factors
sum_contrasts <- list(

  distractor_type = "contr.sum",
  target_present  = "contr.sum"

)


## RT pattern ##

# set_size centered (3/6/9 -> -3/0/3): main effects at the average set size
rt_model_data <- copy(data$vs$rt_cells)[, `:=`(

  set_size_c      = set_size - 6,
  distractor_type = factor(distractor_type),
  target_present  = factor(target_present)

)]


models$rt <- lmer(

  avg_rt ~ set_size_c * distractor_type * target_present + (1 | sona_id),
  data      = rt_model_data,
  contrasts = sum_contrasts

)


car::Anova(models$rt, type = 3)


# Search slope (ms/item) within each distractor x target cell
models$rt_trends <- emtrends(

  models$rt,
  specs = ~ target_present | distractor_type,
  var   = "set_size_c"

)


summary(models$rt_trends)


## Mindfulness x RT ##

# UPDATE from the final run (N = 136):
# Mindfulness did not predict visual search RT, chi2(1) = __, p = __, nor
# did it interact with distractor type, chi2(2) = __, p = __, target
# presence, chi2(1) = __, p = __, or both, chi2(2) = __, p = __.

# Grand-mean centered on subjects, not rows
mind_mean <- mean(data$scores$mindfulness, na.rm = TRUE)

mind_model_data <- data$cond[!is.na(mindfulness)][, `:=`(

  mindfulness_c   = mindfulness - mind_mean,
  distractor_type = factor(distractor_type),
  target_present  = factor(target_present, labels = target_labs)

)]


models$mind <- lmer(

  avg_rt ~ mindfulness_c * distractor_type * target_present + (1 | sona_id),
  data      = mind_model_data,
  contrasts = sum_contrasts

)


car::Anova(models$mind, type = 3)


# Mindfulness slope (ms per scale point) within each condition
models$mind_trends <- emtrends(

  models$mind,
  specs = ~ target_present | distractor_type,
  var   = "mindfulness_c"

)


summary(models$mind_trends, infer = TRUE)


# Present vs. Absent slopes within each distractor type
pairs(models$mind_trends, by = "distractor_type") |>

  summary(by = NULL, adjust = "bonferroni")


# 8. Plots ---------------------------------------------------------------------

plots <- list()


## Plot helpers ##

# RT ~ survey score, faceted by distractor; r per target condition
make_survey_rt_plot <- function(x_var, x_label, title, subtitle) {

  d <- data$cond[!is.na(get(x_var))]


  labels <- d[

    , list(label = paste0(

      fifelse(target_present, "Present", "Absent"), ": ",
      cor_label(cor.test(get(x_var), avg_rt))

    )),
    by = list(distractor_type, target_present)

  ][

    order(distractor_type, target_present),
    list(label = paste(label, collapse = "<br>")),
    by = distractor_type

  ]


  ggplot(

    d,
    aes(x     = .data[[x_var]],
        y     = avg_rt,
        color = factor(target_present, labels = target_labs))

  ) +

    geom_point(alpha = 0.5, size = 2) +

    geom_smooth(method = "lm", formula = y ~ x, se = TRUE) +

    cor_text_layer(labels) +

    facet_wrap(~ distractor_type, labeller = distractor_labs) +

    expand_limits(y = 0) +                     # Full data; axis starts at 0

    labs(title = title, subtitle = subtitle,
         x = x_label, y = "Average RT (ms)") +

    guides(color = guide_legend(title = "Target")) +

    theme_facets

}


# Search slope ~ survey score, faceted by distractor
make_slope_plot <- function(x_var, x_label, title) {

  d <- data$slopes[!is.na(get(x_var))]


  labels <- d[

    , list(label = cor_label(cor.test(get(x_var), slope))),
    by = distractor_type

  ]


  ggplot(d, aes(x = .data[[x_var]], y = slope)) +

    geom_point(alpha = 0.5, size = 2) +

    geom_smooth(method = "lm", formula = y ~ x, se = TRUE) +

    cor_text_layer(labels) +

    facet_wrap(~ distractor_type, labeller = distractor_labs) +

    labs(title = title, x = x_label, y = "RT Slope (ms/item)") +

    theme_pcj(default_caption = FALSE)

}


# Survey subscale intercorrelation (one point per subject)
make_scale_plot <- function(x_var, y_var, x_label, y_label) {

  ct <- cor.test(data$scores[[x_var]], data$scores[[y_var]])


  ggplot(data$scores, aes(x = .data[[x_var]], y = .data[[y_var]])) +

    geom_point() +

    geom_smooth(method = "lm", formula = y ~ x, se = TRUE) +

    labs(

      title    = paste("Relationship Between", x_label, "and", y_label),
      subtitle = cor_subtitle(ct),
      x        = paste(x_label, "Score"),
      y        = paste(y_label, "Score")

    ) +

    theme_pcj(default_caption = FALSE,
              plot.title = element_text(size = rel(2.2))) +

    theme(plot.subtitle = ggtext::element_markdown())

}


## Visual search ##

plots$vs_accuracy <- ggplot(

  data$vs$acc_cells,
  aes(x     = set_size,
      y     = prop_correct,
      color = factor(target_present, labels = target_labs))

) +

  geom_point(                                  # Subject-level cells

    position = position_jitterdodge(jitter.width  = 0.4,
                                    jitter.height = 0,
                                    dodge.width   = 0.5),
    alpha    = 0.15,
    size     = 1

  ) +

  stat_summary(fun.data = mean_cl_boot,
               position = position_dodge(width = 0.5)) +

  facet_wrap(~ distractor_type, labeller = distractor_labs) +

  scale_x_continuous(breaks = c(3, 6, 9)) +

  scale_y_continuous(limits = c(0, 1)) +       # Proportions: no data lost

  labs(

    title    = "Accuracy by Condition",
    subtitle = "Proportion correct by set size, distractor, and target",
    x        = "Set Size",
    y        = "Proportion Correct"

  ) +

  guides(color = guide_legend(title = "Target")) +

  theme_facets


plots$vs_rt <- ggplot(

  data$vs$rt_cells,
  aes(x     = set_size,
      y     = avg_rt,
      color = factor(target_present, labels = target_labs))

) +

  stat_summary(

    fun.data  = mean_cl_boot,
    position  = position_dodge(width = 0.75),
    size      = 0.75,
    linewidth = 0.75

  ) +

  facet_wrap(~ distractor_type, labeller = distractor_labs) +

  scale_x_continuous(breaks = c(3, 6, 9)) +

  coord_cartesian(                             # Zoom only; keeps all data

    ylim = c(0, data$vs$rt_stats$m + 2 * data$vs$rt_stats$sd)

  ) +

  labs(

    title    = "Slow Correct Decisions when Target Absent:",
    subtitle = "Set Size and Conjunction Effects",
    x        = "Set Size",
    y        = "Average RT (ms)"

  ) +

  guides(color = guide_legend(title = "Target")) +

  theme_facets


## Search slopes ##

# Titles neutral until checked against final r values
plots$mindfulness_slope <- make_slope_plot(

  "mindfulness", "Mindfulness Score",
  "Mindfulness and Search Efficiency"

)


plots$conscientiousness_slope <- make_slope_plot(

  "conscientiousness", "Conscientiousness Score",
  "Conscientiousness and Search Efficiency"

)


## Survey x RT ##

# Subtitles neutral until checked against final r values
plots$satisfaction_rt <- make_survey_rt_plot(

  "satisfaction", "Life Satisfaction Score",
  "Life Satisfaction and Visual Search RT",
  "Correlations by distractor type and target presence"

)


plots$conscientiousness_rt <- make_survey_rt_plot(

  "conscientiousness", "Conscientiousness Score",
  "Conscientiousness and Visual Search RT",
  "Correlations by distractor type and target presence"

)


plots$mindfulness_rt <- make_survey_rt_plot(

  "mindfulness", "Mindfulness Score",
  "Mindfulness and Visual Search RT",
  "Correlations by distractor type and target presence"

)


## Survey intercorrelations ##

plots$mindfulness_satisfaction <- make_scale_plot(

  "mindfulness", "satisfaction", "Mindfulness", "Life Satisfaction"

)


plots$mindfulness_conscientiousness <- make_scale_plot(

  "mindfulness", "conscientiousness", "Mindfulness", "Conscientiousness"

)


plots$conscientiousness_satisfaction <- make_scale_plot(

  "satisfaction", "conscientiousness", "Life Satisfaction", "Conscientiousness"

)


# 9. Save & Backup -------------------------------------------------------------

plot_saver(

  plots   = plots,
  dir     = paths$plots,
  names   = names(plots),
  dpi     = 600,
  preview = FALSE,
  width   = 15.5,
  height  = 9

)


git_push(push = TRUE)


# 10. Report: Numbers for the Manuscript ---------------------------------------

report <- list(

  n_raw         = uniqueN(data$raw$sona_id),
  n_rt_excluded = length(rt_excl),
  n_final       = length(data$demo$ids),
  gender        = data$demo$table[, .N, by = gender],
  age           = data$demo$age,
  scale_means   = data$scores[, lapply(.SD, function(x) round(c(
    M = mean(x, na.rm = TRUE), SD = sd(x, na.rm = TRUE)), 2)),
    .SDcols = -"sona_id"],
  cors          = with(data$scores, list(

    mind_sat = cor_subtitle(cor.test(mindfulness,  satisfaction)),
    mind_con = cor_subtitle(cor.test(mindfulness,  conscientiousness)),
    sat_con  = cor_subtitle(cor.test(satisfaction, conscientiousness))

  )),
  low_accuracy  = data$vs$low_acc[prop_low > 0][order(-prop_low)]

)


report